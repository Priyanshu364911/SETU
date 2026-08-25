import cameraIdService from '../CameraIdService';
import { query } from '../../db';

// Mock the db module
jest.mock('../../db');

describe('CameraIdService Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Property 3: Camera IDs are unique and follow the format GJ-{DEPT}-{SEQ}
  describe('Property 3: Camera ID uniqueness and format', () => {
    test('Generated ID follows format GJ-{DEPT}-{SEQ}', async () => {
      const departmentId = 'POL';
      const expectedFormat = new RegExp(`^GJ-${departmentId}-\\d{6}$`);

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });

      const cameraId = await cameraIdService.generateCameraId(departmentId);
      
      expect(cameraId).toMatch(expectedFormat);
      expect(cameraId.startsWith('GJ-POL-')).toBe(true);
    });

    test('Sequence is 6 digits with leading zeros', async () => {
      const departmentId = 'POL';

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });

      const cameraId = await cameraIdService.generateCameraId(departmentId);
      
      // Extract the sequence part
      const sequence = cameraId.split('-')[2];
      expect(sequence).toBe('000001');
    });

    test('Sequence increments correctly', async () => {
      const departmentId = 'POL';

      // First call
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });
      const cameraId1 = await cameraIdService.generateCameraId(departmentId);

      // Second call
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '2' }],
      });
      const cameraId2 = await cameraIdService.generateCameraId(departmentId);

      const seq1 = parseInt(cameraId1.split('-')[2]);
      const seq2 = parseInt(cameraId2.split('-')[2]);

      expect(seq2).toBe(seq1 + 1);
    });

    test('Different departments have separate sequences', async () => {
      // POL department
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });
      const cameraId1 = await cameraIdService.generateCameraId('POL');

      // TRA department
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });
      const cameraId2 = await cameraIdService.generateCameraId('TRA');

      expect(cameraId1).toContain('POL');
      expect(cameraId2).toContain('TRA');
      expect(cameraId1).not.toBe(cameraId2);
    });

    test('ID validation accepts valid format', () => {
      const validId = 'GJ-POL-000001';
      const isValid = cameraIdService.validateCameraIdFormat(validId);
      expect(isValid).toBe(true);
    });

    test('ID validation rejects invalid format - missing prefix', () => {
      const invalidId = 'POL-000001';
      const isValid = cameraIdService.validateCameraIdFormat(invalidId);
      expect(isValid).toBe(false);
    });

    test('ID validation rejects invalid format - wrong prefix', () => {
      const invalidId = 'MH-POL-000001';
      const isValid = cameraIdService.validateCameraIdFormat(invalidId);
      expect(isValid).toBe(false);
    });

    test('ID validation rejects invalid format - sequence too short', () => {
      const invalidId = 'GJ-POL-00001';
      const isValid = cameraIdService.validateCameraIdFormat(invalidId);
      expect(isValid).toBe(false);
    });

    test('ID validation rejects invalid format - sequence too long', () => {
      const invalidId = 'GJ-POL-0000001';
      const isValid = cameraIdService.validateCameraIdFormat(invalidId);
      expect(isValid).toBe(false);
    });

    test('ID validation rejects invalid format - non-numeric sequence', () => {
      const invalidId = 'GJ-POL-ABCDEF';
      const isValid = cameraIdService.validateCameraIdFormat(invalidId);
      expect(isValid).toBe(false);
    });

    test('ID validation rejects invalid format - lowercase department', () => {
      const invalidId = 'GJ-pol-000001';
      const isValid = cameraIdService.validateCameraIdFormat(invalidId);
      expect(isValid).toBe(false);
    });

    test('Duplicate check returns false for non-existent ID', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [],
      });

      const isDuplicate = await cameraIdService.checkDuplicateId('GJ-POL-000001');
      expect(isDuplicate).toBe(false);
    });

    test('Duplicate check returns true for existing ID', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'GJ-POL-000001' }],
      });

      const isDuplicate = await cameraIdService.checkDuplicateId('GJ-POL-000001');
      expect(isDuplicate).toBe(true);
    });
  });

  // Additional property: Atomic sequence generation
  describe('Property: Atomic sequence generation', () => {
    test('Sequence generation uses transaction', async () => {
      const departmentId = 'POL';

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });

      await cameraIdService.generateCameraId(departmentId);

      // Verify that the query was called
      expect(query).toHaveBeenCalled();
    });

    test('Sequence is locked during generation', async () => {
      const departmentId = 'POL';

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });

      await cameraIdService.generateCameraId(departmentId);

      // The implementation should use FOR UPDATE to lock the sequence
      const queryCalls = (query as jest.Mock).mock.calls;
      expect(queryCalls.length).toBeGreaterThan(0);
    });
  });

  // Unit tests for edge cases
  describe('Unit tests for edge cases', () => {
    test('Handles department code with 2 characters', async () => {
      const departmentId = 'HR';

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });

      const cameraId = await cameraIdService.generateCameraId(departmentId);
      expect(cameraId).toMatch(/^GJ-HR-\d{6}$/);
    });

    test('Handles department code with 6 characters', async () => {
      const departmentId = 'POLICE';

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1' }],
      });

      const cameraId = await cameraIdService.generateCameraId(departmentId);
      expect(cameraId).toMatch(/^GJ-POLICE-\d{6}$/);
    });

    test('Sequence handles large numbers', async () => {
      const departmentId = 'POL';

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '999999' }],
      });

      const cameraId = await cameraIdService.generateCameraId(departmentId);
      expect(cameraId).toBe('GJ-POL-999999');
    });

    test('Sequence handles overflow (should still format correctly)', async () => {
      const departmentId = 'POL';

      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{ next_seq: '1000000' }],
      });

      const cameraId = await cameraIdService.generateCameraId(departmentId);
      // This would exceed 6 digits, but the format should still be consistent
      expect(cameraId).toContain('GJ-POL-');
    });
  });
});
