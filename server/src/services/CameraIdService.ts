import { query, transaction } from '../db';

export class CameraIdService {
  async generateCameraId(departmentId: string): Promise<string> {
    // Use a transaction to ensure atomicity
    return transaction(async (client) => {
      // Lock the department's sequence to prevent race conditions
      // We use SELECT ... FOR UPDATE to lock the row
      const result = await client.query(
        `SELECT COALESCE(MAX(CAST(SPLIT_PART(id, '-', 3) AS INTEGER)), 0) + 1 as next_seq
         FROM cameras 
         WHERE department_id = $1
         FOR UPDATE`,
        [departmentId]
      );

      const nextSeq = result.rows[0].next_seq;
      const paddedSeq = nextSeq.toString().padStart(6, '0');
      const cameraId = `GJ-${departmentId}-${paddedSeq}`;

      // Validate the generated ID matches the expected format
      const idRegex = /^GJ-[A-Z]{2,6}-\d{6}$/;
      if (!idRegex.test(cameraId)) {
        throw new Error(`Generated camera ID ${cameraId} does not match required format`);
      }

      return cameraId;
    });
  }

  async checkDuplicateId(cameraId: string): Promise<boolean> {
    const result = await query('SELECT id FROM cameras WHERE id = $1', [cameraId]);
    return result.rows.length > 0;
  }

  validateCameraIdFormat(cameraId: string): boolean {
    const idRegex = /^GJ-[A-Z]{2,6}-\d{6}$/;
    return idRegex.test(cameraId);
  }

  async getNextSequenceNumber(departmentId: string): Promise<number> {
    const result = await query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(id, '-', 3) AS INTEGER)), 0) + 1 as next_seq
       FROM cameras 
       WHERE department_id = $1`,
      [departmentId]
    );
    return result.rows[0].next_seq;
  }
}

export default new CameraIdService();
