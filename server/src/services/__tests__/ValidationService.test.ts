import validationService from '../ValidationService';
import { query } from '../../db';

// Mock the db module
jest.mock('../../db');

describe('ValidationService Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Property 6: Validation rejects invalid coordinates (outside Gujarat bounds)
  describe('Property 6: Invalid coordinates are rejected', () => {
    test('Latitude below Gujarat minimum (20.1) is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 20.0, // Below minimum
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'latitude')).toBe(true);
    });

    test('Latitude above Gujarat maximum (24.7) is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 24.8, // Above maximum
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'latitude')).toBe(true);
    });

    test('Longitude below Gujarat minimum (68.2) is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 68.1, // Below minimum
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'longitude')).toBe(true);
    });

    test('Longitude above Gujarat maximum (74.5) is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 74.6, // Above maximum
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'longitude')).toBe(true);
    });

    test('Valid coordinates within Gujarat bounds are accepted', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0, // Within bounds
        longitude: 72.0, // Within bounds
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  // Property 14: Validation rejects invalid enum values
  describe('Property 14: Invalid enum values are rejected', () => {
    test('Invalid camera_type is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'INVALID' as any, // Invalid enum
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('Invalid connectivity is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'INVALID' as any, // Invalid enum
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('Invalid storage_type is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'INVALID' as any, // Invalid enum
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('Invalid ownership is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'INVALID' as any, // Invalid enum
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('Valid enum values are accepted', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(true);
    });
  });

  // Property 15: Validation rejects missing required fields
  describe('Property 15: Missing required fields are rejected', () => {
    test('Missing name is rejected', async () => {
      const input = {
        name: '', // Empty name
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('Missing department_id is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: '', // Empty department
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('Missing district_id is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: '', // Empty district
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('Retention days out of range is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 400, // Above maximum
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
    });

    test('All required fields present and valid is accepted', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(true);
    });
  });

  // Additional property: FK existence checks
  describe('Property: Foreign key existence is validated', () => {
    test('Non-existent department is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'NONEXISTENT',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [] }); // Department not found
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'department_id')).toBe(true);
    });

    test('Non-existent district is rejected', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'NONEXISTENT',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [] }); // District not found

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'district_id')).toBe(true);
    });

    test('Valid FK references are accepted', async () => {
      const input = {
        name: 'Test Camera',
        department_id: 'POL',
        district_id: 'D01',
        latitude: 22.0,
        longitude: 72.0,
        camera_type: 'IP' as const,
        connectivity: 'Fiber' as const,
        storage_type: 'Local NVR' as const,
        retention_days: 30,
        ownership: 'Govt' as const,
      };

      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'POL' }] });
      (query as jest.Mock).mockResolvedValue({ rows: [{ id: 'D01' }] });

      const result = await validationService.validateCameraInput(input);
      expect(result.valid).toBe(true);
    });
  });
});
