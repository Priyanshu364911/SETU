import { query, transaction } from '../db';
import { CameraInput, BulkImportResult, TokenPayload, OnboardingStatus } from '../types';
import validationService from './ValidationService';
import cameraIdService from './CameraIdService';
import auditService from './AuditService';
import * as csvParse from 'csv-parse';

export class OnboardingService {
  async submitManual(input: CameraInput, actor: TokenPayload) {
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

    // Insert camera with Pending status
    const queryStr = `
      INSERT INTO cameras (
        id, name, department_id, district_id, location,
        camera_type, connectivity, storage_type, retention_days, ownership,
        status, onboarding_status, onboarding_method, onboarded_by, notes
      ) VALUES (
        $1, $2, $3, $4, ST_GeomFromText('POINT(' || $5 || ' ' || $6 || ')', 4326),
        $7, $8, $9, $10, $11,
        'Pending', 'Pending', 'Manual', $12, $13
      ) RETURNING id, onboarding_status
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

    const row = result.rows[0];

    // Audit log the manual submission
    await auditService.logEntry(
      'ONBOARD_SUBMIT',
      actor,
      row.id,
      'camera',
      null,
      row,
      { method: 'Manual' },
      null,
    );

    return row;
  }

  async submitBulkCSV(csvBuffer: Buffer, actor: TokenPayload): Promise<BulkImportResult> {
    const departments = await validationService.getValidDepartments();
    const districts = await validationService.getValidDistricts();
    const existingIds = await this.getExistingCameraIds();

    const validRows: CameraInput[] = [];
    const errors: Array<{ row: number; field: string; message: string }> = [];

    return new Promise((resolve, reject) => {
      csvParse.parse(csvBuffer, {
        columns: true,
        skip_empty_lines: true,
      }, async (err, records: any[]) => {
        if (err) {
          return reject(err);
        }

        const seenInBatch = new Set<string>();

        for (let i = 0; i < records.length; i++) {
          const row = records[i];
          const rowErrors: Array<{ field: string; message: string }> = [];

          // Required field checks
          const requiredFields = ['name', 'department_id', 'district_id', 'latitude', 'longitude', 
                                   'camera_type', 'connectivity', 'storage_type', 'retention_days', 'ownership'];
          for (const field of requiredFields) {
            if (!row[field] || row[field].toString().trim() === '') {
              rowErrors.push({ field, message: 'Required field missing' });
            }
          }

          // Lat/Lng bounds
          const lat = parseFloat(row.latitude);
          const lng = parseFloat(row.longitude);
          if (isNaN(lat) || lat < 20.1 || lat > 24.7) {
            rowErrors.push({ field: 'latitude', message: 'Outside Gujarat bounds [20.1, 24.7]' });
          }
          if (isNaN(lng) || lng < 68.2 || lng > 74.5) {
            rowErrors.push({ field: 'longitude', message: 'Outside Gujarat bounds [68.2, 74.5]' });
          }

	  // Enum checks
          const validCameraTypes = ['IP', 'Analog', 'PTZ', 'ANPR'];
          const validConnectivity = ['Fiber', '4G', 'Microwave', 'Other'];
          const validStorage = ['Local NVR', 'Cloud', 'Hybrid'];
          const validOwnership = ['Govt', 'Private'];

          if (!validCameraTypes.includes(row.camera_type)) {
            rowErrors.push({ field: 'camera_type', message: 'Invalid value' });
          }
          if (!validConnectivity.includes(row.connectivity)) {
            rowErrors.push({ field: 'connectivity', message: 'Invalid value' });
          }
          if (!validStorage.includes(row.storage_type)) {
            rowErrors.push({ field: 'storage_type', message: 'Invalid value' });
          }
          if (!validOwnership.includes(row.ownership)) {
            rowErrors.push({ field: 'ownership', message: 'Invalid value' });
          }

          // FK checks
          if (!departments.includes(row.department_id)) {
            rowErrors.push({ field: 'department_id', message: 'Unknown department' });
          }
          if (!districts.includes(row.district_id)) {
            rowErrors.push({ field: 'district_id', message: 'Unknown district' });
          }

          // Duplicate check (DB + batch)
          if (row.id) {
            if (existingIds.has(row.id) || seenInBatch.has(row.id)) {
              rowErrors.push({ field: 'id', message: 'Duplicate camera ID' });
            } else {
              seenInBatch.add(row.id);
            }
          }

          // Retention days validation
          const retentionDays = parseInt(row.retention_days);
          if (isNaN(retentionDays) || retentionDays < 1 || retentionDays > 365) {
            rowErrors.push({ field: 'retention_days', message: 'Must be between 1 and 365' });
          }

          if (rowErrors.length > 0) {
            for (const error of rowErrors) {
              errors.push({ row: i + 1, ...error });
            }
          } else {
            validRows.push({
              id: row.id || undefined,
              name: row.name,
              department_id: row.department_id,
              district_id: row.district_id,
              latitude: lat,
              longitude: lng,
              camera_type: row.camera_type,
              connectivity: row.connectivity,
              storage_type: row.storage_type,
              retention_days: retentionDays,
              ownership: row.ownership,
              notes: row.notes || undefined,
            });
          }
        }

        // Insert valid rows
        let insertedCount = 0;
        for (const row of validRows) {
          try {
            const cameraId = row.id || await cameraIdService.generateCameraId(row.department_id);
            
            await query(
              `INSERT INTO cameras (
                id, name, department_id, district_id, location,
                camera_type, connectivity, storage_type, retention_days, ownership,
                status, onboarding_status, onboarding_method, onboarded_by, notes
              ) VALUES (
                $1, $2, $3, $4, ST_GeomFromText('POINT(' || $5 || ' ' || $6 || ')', 4326),
                $7, $8, $9, $10, $11,
                'Pending', 'Pending', 'Bulk CSV', $12, $13
              )`,
              [
                cameraId,
                row.name,
                row.department_id,
                row.district_id,
                row.longitude,
                row.latitude,
                row.camera_type,
                row.connectivity,
                row.storage_type,
                row.retention_days,
                row.ownership,
                actor.userId,
                row.notes,
              ]
            );
            insertedCount++;
          } catch (error) {
            errors.push({ row: validRows.indexOf(row) + 1, field: 'general', message: 'Insert failed' });
          }
        }

        resolve({
          accepted: insertedCount,
          rejected: errors.length,
          errors,
        });

        // Audit log the bulk upload
        auditService.logEntry(
          'BULK_UPLOAD',
          actor,
          null,
          null,
          null,
          null,
          { count: insertedCount, rejected: errors.length },
          null,
        ).catch(() => { /* non-blocking — don't fail the response on audit error */ });
      });
    });
  }

  async getQueue(filters: any, pagination: any, actor: TokenPayload) {
    const { page = 1, pageSize = 50 } = pagination;
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ["onboarding_status IN ('Pending', 'Validation')"];
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC scoping
    if (actor.scopedTo) {
      conditions.push(`department_id = $${paramIndex}`);
      params.push(actor.scopedTo);
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
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(pageSize, offset);
    const dataResult = await query(dataQuery, params);

    return {
      data: dataResult.rows,
      total,
      page,
      pageSize,
    };
  }

  async approve(cameraId: string, actor: TokenPayload) {
    // Field Officers cannot approve
    if (actor.role === 'field_officer') {
      throw new Error('Access denied');
    }

    // Get existing camera
    const existing = await query('SELECT * FROM cameras WHERE id = $1', [cameraId]);
    if (existing.rows.length === 0) {
      throw new Error('Camera not found');
    }

    const camera = existing.rows[0];

    // RBAC check
    if (actor.scopedTo && camera.department_id !== actor.scopedTo) {
      throw new Error('Access denied');
    }

    // Check valid status transition
    const validTransitions = ['Pending', 'Validation'];
    if (!validTransitions.includes(camera.onboarding_status)) {
      throw new Error('Invalid status transition');
    }

    // Update camera
    await query(
      `UPDATE cameras 
       SET onboarding_status = 'Approved', status = 'Online', last_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [cameraId]
    );

    // Audit log the approval
    await auditService.logEntry(
      'ONBOARD_APPROVE',
      actor,
      cameraId,
      'camera',
      { onboarding_status: camera.onboarding_status },
      { onboarding_status: 'Approved', status: 'Online' },
      null,
      null,
    );

    return { id: cameraId, onboarding_status: 'Approved', status: 'Online' };
  }

  async reject(cameraId: string, reason: string, actor: TokenPayload) {
    // Field Officers cannot reject
    if (actor.role === 'field_officer') {
      throw new Error('Access denied');
    }

    // Get existing camera
    const existing = await query('SELECT * FROM cameras WHERE id = $1', [cameraId]);
    if (existing.rows.length === 0) {
      throw new Error('Camera not found');
    }

    const camera = existing.rows[0];

    // RBAC check
    if (actor.scopedTo && camera.department_id !== actor.scopedTo) {
      throw new Error('Access denied');
    }

    // Check valid status transition
    const validTransitions = ['Pending', 'Validation'];
    if (!validTransitions.includes(camera.onboarding_status)) {
      throw new Error('Invalid status transition');
    }

    // Update camera
    await query(
      `UPDATE cameras 
       SET onboarding_status = 'Rejected', notes = COALESCE(notes, '') || ' Rejection: ' || $1, updated_at = NOW()
       WHERE id = $2`,
      [reason, cameraId]
    );

    // Audit log the rejection
    await auditService.logEntry(
      'ONBOARD_REJECT',
      actor,
      cameraId,
      'camera',
      { onboarding_status: camera.onboarding_status },
      { onboarding_status: 'Rejected', reason },
      null,
      null,
    );

    return { id: cameraId, onboarding_status: 'Rejected' };
  }

  async getExistingCameraIds(): Promise<Set<string>> {
    const result = await query('SELECT id FROM cameras');
    return new Set(result.rows.map(row => row.id));
  }
}

export default new OnboardingService();
