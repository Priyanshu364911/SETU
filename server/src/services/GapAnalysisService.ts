import { query } from '../db';
import { GapZone, DistrictRanking, Camera } from '../types';

export class GapAnalysisService {
  async getLowCoverageZones(threshold: number): Promise<GapZone[]> {
    // Validate threshold
    if (threshold <= 0 || threshold >= 1) {
      throw new Error('Threshold must be between 0 and 1');
    }

    const queryStr = `
      SELECT 
        d.id as district_id,
        d.name as district_name,
        ST_Y(d.centroid) as lat,
        ST_X(d.centroid) as lng,
        COALESCE(COUNT(c.id), 0) as camera_count
      FROM districts d
      LEFT JOIN cameras c ON c.district_id = d.id 
                        AND c.onboarding_status = 'Approved'
      GROUP BY d.id, d.name, d.centroid
    `;

    const result = await query(queryStr);
    const districtCounts = result.rows;

    // Calculate average
    const total = districtCounts.reduce((sum, row) => sum + parseInt(row.camera_count), 0);
    const avgCount = total / districtCounts.length;
    const cutoff = threshold * avgCount;

    // Filter and create gap zones
    const gapZones: GapZone[] = districtCounts
      .filter(row => parseInt(row.camera_count) < cutoff)
      .map(row => ({
        district_id: row.district_id,
        district_name: row.district_name,
        camera_count: parseInt(row.camera_count),
        avg_per_district: avgCount,
        deficit: avgCount - parseInt(row.camera_count),
        coordinates: [parseFloat(row.lat), parseFloat(row.lng)] as [number, number],
      }))
      .sort((a, b) => b.deficit - a.deficit); // Sort by deficit descending

    return gapZones;
  }

  async getAgeingInfrastructure(thresholdDays: number = 90): Promise<Camera[]> {
    // Validate thresholdDays — must be a positive integer to prevent injection
    const safeThreshold = Math.max(1, Math.floor(Number(thresholdDays)));

    const queryStr = `
      SELECT 
        id, name, department_id, district_id,
        ST_Y(location) as latitude, ST_X(location) as longitude,
        camera_type, connectivity, storage_type, retention_days, ownership,
        status, onboarding_status, onboarding_method, onboarded_by,
        onboarded_at, last_verified_at, notes, created_at, updated_at
      FROM cameras
      WHERE onboarding_status = 'Approved'
        AND (last_verified_at IS NULL 
             OR last_verified_at < NOW() - ($1 * INTERVAL '1 day'))
      ORDER BY last_verified_at ASC NULLS FIRST
    `;

    const result = await query(queryStr, [safeThreshold]);
    return result.rows;
  }

  async getBelowAverageDistricts(): Promise<DistrictRanking[]> {
    const queryStr = `
     	SELECT 
        d.id as district_id,
        d.name as district_name,
        COALESCE(COUNT(c.id), 0) as camera_count,
        COALESCE(COUNT(c.id) FILTER (WHERE c.status = 'Online'), 0) as online_count
      FROM districts d
      LEFT JOIN cameras c ON c.district_id = d.id 
                        AND c.onboarding_status = 'Approved'
      GROUP BY d.id, d.name
      ORDER BY camera_count DESC
    `;

    const result = await query(queryStr);
    const districts = result.rows;

    // Calculate average
    const total = districts.reduce((sum, row) => sum + parseInt(row.camera_count), 0);
    const avgCount = total / districts.length;

    // Create rankings
    const rankings: DistrictRanking[] = districts.map((row, index) => ({
      district_id: row.district_id,
      district_name: row.district_name,
      camera_count: parseInt(row.camera_count),
      online_rate: parseInt(row.camera_count) > 0 
        ? parseInt(row.online_count) / parseInt(row.camera_count) 
        : 0,
      rank: index + 1,
      below_average: parseInt(row.camera_count) < avgCount,
    }));

    return rankings;
  }

  async exportReport(format: 'csv' | 'pdf' = 'csv'): Promise<Buffer> {
    const gapZones = await this.getLowCoverageZones(0.5);
    const rankings = await this.getBelowAverageDistricts();

    if (format === 'csv') {
      let csv = 'Gap Analysis Report\n\n';
      csv += 'Low Coverage Zones\n';
      csv += 'District ID,District Name,Camera Count,Average Per District,Deficit,Lat,Lng\n';
      
      for (const zone of gapZones) {
        csv += `${zone.district_id},${zone.district_name},${zone.camera_count},${zone.avg_per_district.toFixed(2)},${zone.deficit.toFixed(2)},${zone.coordinates[0]},${zone.coordinates[1]}\n`;
      }

      csv += '\nDistrict Rankings\n';
      csv += 'District ID,District Name,Camera Count,Online Rate,Rank,Below Average\n';
      
      for (const ranking of rankings) {
        csv += `${ranking.district_id},${ranking.district_name},${ranking.camera_count},${(ranking.online_rate * 100).toFixed(2)}%,${ranking.rank},${ranking.below_average}\n`;
      }

      return Buffer.from(csv);
    }

    // For PDF, we would use a library like pdfkit - for now return CSV
    return this.exportReport('csv');
  }
}

export default new GapAnalysisService();
