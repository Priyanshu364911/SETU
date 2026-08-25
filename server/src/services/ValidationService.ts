import { CameraInput, ValidationResult, FieldError } from '../types';
import { CameraInputSchema } from '../schemas';
import { query } from '../db';

export class ValidationService {
  async validateCameraInput(input: CameraInput): Promise<ValidationResult> {
    const errors: FieldError[] = [];

    // 1. Zod schema validation for basic type and format checks
    try {
      CameraInputSchema.parse(input);
    } catch (error) {
      if (error instanceof Error) {
        // Parse Zod error for field-level messages
        const zodError = error as any;
        if (zodError.errors) {
          for (const err of zodError.errors) {
            errors.push({
              field: err.path.join('.'),
              message: err.message,
            });
          }
        }
      }
    }

    // 2. Camera ID format validation (if provided)
    if (input.id) {
      const idRegex = /^GJ-[A-Z]{2,6}-\d{6}$/;
      if (!idRegex.test(input.id)) {
        errors.push({
          field: 'id',
          message: 'Camera ID must match format GJ-DEPTCODE-NNNNNN (e.g., GJ-POL-000042)',
        });
      }
    }

    // 3. Gujarat coordinate bounds validation
    if (input.latitude < 20.1 || input.latitude > 24.7) {
      errors.push({
        field: 'latitude',
        message: 'Latitude must be within Gujarat bounds [20.1, 24.7]',
      });
    }

    if (input.longitude < 68.2 || input.longitude > 74.5) {
      errors.push({
        field: 'longitude',
        message: 'Longitude must be within Gujarat bounds [68.2, 74.5]',
      });
    }

    // 4. Retention days validation (already covered by Zod, but double-check)
    if (input.retention_days < 1 || input.retention_days > 365) {
      errors.push({
        field: 'retention_days',
        message: 'Retention days must be between 1 and 365',
      });
    }

    // 5. Name length validation (already covered by Zod)
    if (input.name.length === 0 || input.name.length > 200) {
      errors.push({
        field: 'name',
        message: 'Name must be between 1 and 200 characters',
      });
    }

    // 6. FK existence checks (department and district)
    const deptExists = await this.departmentExists(input.department_id);
    if (!deptExists) {
      errors.push({
        field: 'department_id',
        message: 'Department does not exist',
      });
    }

    const districtExists = await this.districtExists(input.district_id);
    if (!districtExists) {
      errors.push({
        field: 'district_id',
        message: 'District does not exist',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async departmentExists(departmentId: string): Promise<boolean> {
    const result = await query('SELECT id FROM departments WHERE id = $1', [departmentId]);
    return result.rows.length > 0;
  }

  async districtExists(districtId: string): Promise<boolean> {
    const result = await query('SELECT id FROM districts WHERE id = $1', [districtId]);
    return result.rows.length > 0;
  }

  async cameraIdExists(cameraId: string): Promise<boolean> {
    const result = await query('SELECT id FROM cameras WHERE id = $1', [cameraId]);
    return result.rows.length > 0;
  }

  async getValidDepartments(): Promise<string[]> {
    const result = await query('SELECT id FROM departments ORDER BY id');
    return result.rows.map(row => row.id);
  }

  async getValidDistricts(): Promise<string[]> {
    const result = await query('SELECT id FROM districts ORDER BY id');
    return result.rows.map(row => row.id);
  }
}

export default new ValidationService();
