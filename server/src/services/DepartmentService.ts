import { query } from '../db';
import { Department } from '../types';

export class DepartmentService {
  async list(): Promise<Department[]> {
    const queryStr = `
      SELECT 
        d.id, d.name, d.nodal_officer_name, d.nodal_officer_email, d.created_at,
        COALESCE(COUNT(c.id), 0) as camera_count
      FROM departments d
      LEFT JOIN cameras c ON c.department_id = d.id 
                        AND c.onboarding_status = 'Approved'
      GROUP BY d.id, d.name, d.nodal_officer_name, d.nodal_officer_email, d.created_at
      ORDER BY d.name
    `;

    const result = await query(queryStr);
    return result.rows;
  }

  async getById(id: string): Promise<Department> {
    const queryStr = `
      SELECT 
        d.id, d.name, d.nodal_officer_name, d.nodal_officer_email, d.created_at,
        COALESCE(COUNT(c.id), 0) as camera_count
      FROM departments d
      LEFT JOIN cameras c ON c.department_id = d.id 
                        AND c.onboarding_status = 'Approved'
      WHERE d.id = $1
      GROUP BY d.id, d.name, d.nodal_officer_name, d.nodal_officer_email, d.created_at
    `;

    const result = await query(queryStr, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Department not found');
    }

    return result.rows[0];
  }

  async getCameraCount(departmentId: string): Promise<number> {
    const queryStr = `
      SELECT COUNT(*) as count
      FROM cameras
      WHERE department_id = $1 AND onboarding_status = 'Approved'
    `;

    const result = await query(queryStr, [departmentId]);
    return parseInt(result.rows[0].count);
  }

  async create(name: string, nodalOfficerName: string, nodalOfficerEmail: string): Promise<Department> {
    // Generate department ID (first 3 letters of name, uppercase)
    const id = name.substring(0, 3).toUpperCase();

    const queryStr = `
      INSERT INTO departments (id, name, nodal_officer_name, nodal_officer_email)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await query(queryStr, [id, name, nodalOfficerName, nodalOfficerEmail]);
    return result.rows[0];
  }
}

export default new DepartmentService();
