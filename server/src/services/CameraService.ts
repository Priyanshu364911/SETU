import { query, transaction } from '../db';
import { Camera, CameraInput, CameraFilters, Pagination, PaginatedResult, TokenPayload, CameraStats, GeoJSONFeatureCollection } from '../types';
import validationService from './ValidationService';
import cameraIdService from './CameraIdService';
import auditService from './AuditService';
import NodeCache from 'node-cache';

const statsCache = new NodeCache({ stdTTL: 60 }); // 60 second cache

export class CameraService {
  async list(filters: CameraFilters, pagination: Pagination, actor: TokenPayload): Promise<PaginatedResult<Camera>> {
    const { page = 1, pageSize = 50, sortBy = 'created_at', sortOrder = 'desc' } = pagination;
    
    // Enforce max page size
    const effectivePageSize = Math.min(pageSize, 500);
    const offset = (page - 1) * effectivePageSize;

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC scoping
    if (actor.scopedTo) {
      conditions.push(`department_id = ANY($${paramIndex})`);
      params.push([actor.scopedTo]);
      paramIndex++;
    }

    // Field Officer: exclude rejected cameras
    if (actor.role === 'field_officer') {
      conditions.push(`onboarding_status != 'Rejected'`);
    }

    // Apply filters
    if (filters.departmentId) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(filters.departmentId);
      paramIndex++;
    }

    if (filters.districtId) {
      conditions.push(`district_id = $${paramIndex}`);
      params.push(filters.districtId);
      paramIndex++;
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(`status = ANY($${paramIndex})`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.cameraType && filters.cameraType.length > 0) {
      conditions.push(`camera_type = ANY($${paramIndex})`);
      params.push(filters.cameraType);
      paramIndex++;
    }

    if (filters.connectivity && filters.connectivity.length > 0) {
      conditions.push(`connectivity = ANY($${paramIndex})`);
      params.push(filters.connectivity);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR id ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.onboardedAfter) {
      conditions.push(`onboarded_at >= $${paramIndex}`);
      params.push(filters.onboardedAfter);
      paramIndex++;
    }

    if (filters.onboardedBefore) {
      conditions.push(`onboarded_at <= $${paramIndex}`);
      params.push(filters.onboardedBefore);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM cameras
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated data
    const dataQuery = `
      SELECT 
        id, name, department_id, district_id,
        ST_Y(location) as latitude, ST_X(location) as longitude,
        camera_type, connectivity, storage_type, retention_days, ownership,
        status, onboarding_status, onboarding_method, onboarded_by,
        onboarded_at, last_verified_at, notes, created_at, updated_at
      FROM cameras
      ${whereClause}
      ORDER BY ${this.escapeIdentifier(sortBy)} ${sortOrder.toUpperCase()}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(effectivePageSize, offset);
    const dataResult = await query(dataQuery, params);

    return {
      data: dataResult.rows,
      total,
      page,
      pageSize: effectivePageSize,
    };
  }

  async getById(id: string, actor: TokenPayload): Promise<Camera> {
    const queryStr = `
      SELECT 
        id, name, department_id, district_id,
        ST_Y(location) as latitude, ST_X(location) as longitude,
        camera_type, connectivity, storage_type, retention_days, ownership,
        status, onboarding_status, onboarding_method, onboarded_by,
        onboarded_at, last_verified_at, notes, created_at, updated_at
      FROM cameras
      WHERE id = $1
    `;

    const result = await query(queryStr, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Camera not found');
    }

    const camera = result.rows[0];

    // RBAC check
    if (actor.scopedTo && camera.department_id !== actor.scopedTo) {
      throw new Error('Access denied');
    }

    // Field Officer: exclude rejected cameras
    if (actor.role === 'field_officer' && camera.onboarding_status === 'Rejected') {
      throw new Error('Access denied');
    }

    return camera;
  }

  async create(input: CameraInput, actor: TokenPayload): Promise<Camera> {
    // Validate input
    const validation = await validationService.validateCameraInput(input);
    if (!validation.valid) {
      throw new Error(JSON.stringify(validation.errors));
    }

    // Generate camera ID
    const cameraId = input.id || await cameraIdService.generateCameraId(input.department_id);

    // Check for duplicate ID
    const duplicateExists = await cameraIdService.checkDuplicateId(cameraId);
    if (duplicateExists) {
      throw new Error('DUPLICATE_ID');
    }

    // Insert camera
    const queryStr = `
      INSERT INTO cameras (
        id, name, department_id, district_id, location,
        camera_type, connectivity, storage_type, retention_days, ownership,
        status, onboarding_status, onboarding_method, onboarded_by, notes
      ) VALUES (
        $1, $2, $3, $4, ST_GeomFromText('POINT(' || $5 || ' ' || $6 || ')', 4326),
        $7, $8, $9, $10, $11,
        'Pending', 'Pending', 'Manual', $12, $13
      ) RETURNING *
    `;

    const result = await query(queryStr, [
      cameraId,
      input.name,
      input.department_id,
      input.district_id,
      input.longitude,
      input.latitude,
      input.camera_type,
      input.connectivity,
      input.storage_type,
      input.retention_days,
      input.ownership,
      actor.userId,
      input.notes,
    ]);

    const camera = result.rows[0];

    // Audit log the creation
    await auditService.logEntry(
      'ONBOARD_SUBMIT',
      actor,
      camera.id,
      'camera',
      null,
      camera,
      { method: 'Manual' },
      null,
    );

    return camera;
  }

  async update(id: string, input: Partial<CameraInput>, actor: TokenPayload): Promise<Camera> {
    // Field Officers cannot update
    if (actor.role === 'field_officer') {
      throw new Error('Access denied');
    }

    // Get existing camera (captures before state for audit)
    const existing = await this.getById(id, actor);

    // Validate input
    if (input.department_id || input.district_id || input.camera_type || 
        input.connectivity || input.storage_type || input.ownership) {
      const fullInput = { ...existing, ...input } as CameraInput;
      const validation = await validationService.validateCameraInput(fullInput);
      if (!validation.valid) {
        throw new Error(JSON.stringify(validation.errors));
      }
    }

    // Build update SET clause
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.department_id !== undefined) {
      updates.push(`department_id = $${paramIndex}`);
      params.push(input.department_id);
      paramIndex++;
    }

    if (input.district_id !== undefined) {
      updates.push(`district_id = $${paramIndex}`);
      params.push(input.district_id);
      paramIndex++;
    }

    if (input.latitude !== undefined && input.longitude !== undefined) {
      updates.push(`location = ST_GeomFromText('POINT(' || $${paramIndex} || ' ' || $${paramIndex + 1} || ')', 4326)`);
      params.push(input.longitude, input.latitude);
      paramIndex += 2;
    }

    if (input.camera_type !== undefined) {
      updates.push(`camera_type = $${paramIndex}`);
      params.push(input.camera_type);
      paramIndex++;
    }

    if (input.connectivity !== undefined) {
      updates.push(`connectivity = $${paramIndex}`);
      params.push(input.connectivity);
      paramIndex++;
    }

    if (input.storage_type !== undefined) {
      updates.push(`storage_type = $${paramIndex}`);
      params.push(input.storage_type);
      paramIndex++;
    }

    if (input.retention_days !== undefined) {
      updates.push(`retention_days = $${paramIndex}`);
      params.push(input.retention_days);
      paramIndex++;
    }

    if (input.ownership !== undefined) {
      updates.push(`ownership = $${paramIndex}`);
      params.push(input.ownership);
      paramIndex++;
    }

    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(input.notes);
      paramIndex++;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const queryStr = `
      UPDATE cameras
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id, name, department_id, district_id,
        ST_Y(location) as latitude, ST_X(location) as longitude,
        camera_type, connectivity, storage_type, retention_days, ownership,
        status, onboarding_status, onboarding_method, onboarded_by,
        onboarded_at, last_verified_at, notes, created_at, updated_at
    `;

    const result = await query(queryStr, params);
    const updated = result.rows[0];

    // Audit log the update with before/after snapshots
    await auditService.logEntry(
      'CAMERA_UPDATE',
      actor,
      id,
      'camera',
      existing,
      updated,
      null,
      null,
    );

    return updated;
  }

  async delete(id: string, actor: TokenPayload): Promise<void> {
    // Only State Nodal Officer can delete
    if (actor.role !== 'state_nodal_officer') {
      throw new Error('Access denied');
    }

    // Fetch before state for audit log
    const existing = await this.getById(id, actor);

    await query('DELETE FROM cameras WHERE id = $1', [id]);

    // Audit log the deletion with the full before state
    await auditService.logEntry(
      'CAMERA_DELETE',
      actor,
      id,
      'camera',
      existing,
      null,
      null,
      null,
    );
  }

  async getStats(actor: TokenPayload): Promise<CameraStats> {
    const cacheKey = `stats_${actor.userId}_${actor.role}_${actor.departmentId || 'all'}`;
    const cached = statsCache.get<CameraStats>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC scoping
    if (actor.scopedTo) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(actor.scopedTo);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryStr = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'Online') as online,
        COUNT(*) FILTER (WHERE status = 'Offline') as offline,
        COUNT(*) FILTER (WHERE status = 'Maintenance') as maintenance,
        COUNT(*) FILTER (WHERE status = 'Pending') as pending
      FROM cameras
      ${whereClause}
    `;

    const result = await query(queryStr, params);
    const stats = result.rows[0];

    const cameraStats: CameraStats = {
      total: parseInt(stats.total),
      online: parseInt(stats.online),
      offline: parseInt(stats.offline),
      maintenance: parseInt(stats.maintenance),
      pending: parseInt(stats.pending),
    };

    statsCache.set(cacheKey, cameraStats);
    return cameraStats;
  }

  async getGeoJSON(filters: CameraFilters, actor: TokenPayload): Promise<GeoJSONFeatureCollection> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Only return approved cameras for GeoJSON
    conditions.push(`onboarding_status = 'Approved'`);

    // RBAC scoping
    if (actor.scopedTo) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(actor.scopedTo);
      paramIndex++;
    }

    // Apply filters
    if (filters.departmentId) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(filters.departmentId);
      paramIndex++;
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(`status = ANY($${paramIndex})`);
      params.push(filters.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const queryStr = `
      SELECT 
        id, status, department_id, camera_type,
        ST_X(location) as lng, ST_Y(location) as lat
      FROM cameras
      ${whereClause}
    `;

    const result = await query(queryStr, params);

    const features = result.rows.map(row => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [parseFloat(row.lng), parseFloat(row.lat)] as [number, number],
      },
      properties: {
        id: row.id,
        status: row.status,
        departmentId: row.department_id,
        cameraType: row.camera_type,
      },
    }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  private escapeIdentifier(identifier: string): string {
    // Simple escape for column names to prevent SQL injection
    const allowedColumns = [
      'id', 'name', 'department_id', 'district_id', 'camera_type',
      'connectivity', 'storage_type', 'retention_days', 'ownership',
      'status', 'onboarding_status', 'onboarding_method', 'onboarded_by',
      'onboarded_at', 'last_verified_at', 'created_at', 'updated_at'
    ];
    
    if (!allowedColumns.includes(identifier)) {
      throw new Error(`Invalid column name: ${identifier}`);
    }
    
    return `"${identifier}"`;
  }
}

export default new CameraService();
