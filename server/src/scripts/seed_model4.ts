import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/setu_registry',
});

async function seedModel4() {
  const client = await pool.connect();
  try {
    console.log('[Model4 Seed] Populating Central VMS data...');
    await client.query('BEGIN');

    // ── 1. External Integrations ─────────────────────────────────────────────
    await client.query('DELETE FROM integration_queries');
    await client.query('DELETE FROM external_integrations');

    const integrations = [
      {
        id: 'vahan',
        name: 'VAHAN',
        description: 'Ministry of Road Transport — National Vehicle Registration Database. Provides vehicle ownership, insurance, fitness, and stolen status lookup.',
        system_type: 'vehicle_registry',
        base_url: 'https://vahan.parivahan.gov.in/vahan4dashboard',
        status: 'connected',
      },
      {
        id: 'sarthi',
        name: 'SARTHI',
        description: 'Ministry of Road Transport — National Driving Licence Database. Provides licence validity, endorsements, and suspension status.',
        system_type: 'licence_registry',
        base_url: 'https://sarathi.parivahan.gov.in',
        status: 'connected',
      },
      {
        id: 'egujcop',
        name: 'eGujCop',
        description: 'Gujarat Police — Criminal Records & FIR Database. Provides case status, FIR details, and criminal history lookup.',
        system_type: 'police_db',
        base_url: 'https://egujcop.gujarat.gov.in',
        status: 'degraded',
      },
      {
        id: 'afis',
        name: 'AFIS',
        description: 'Automated Fingerprint Identification System — National Crime Records Bureau. Fingerprint matching against criminal database.',
        system_type: 'fingerprint_db',
        base_url: 'https://ncrb.gov.in/afis',
        status: 'connected',
      },
      {
        id: 'nafis',
        name: 'NAFIS',
        description: 'National Automated Facial Recognition System — Face matching against criminal and missing persons databases.',
        system_type: 'face_db',
        base_url: 'https://nafis.gov.in',
        status: 'maintenance',
      },
    ];

    for (const integ of integrations) {
      await client.query(
        `INSERT INTO external_integrations (id, name, description, system_type, base_url, status, last_sync_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${Math.floor(Math.random() * 60)} minutes')`,
        [integ.id, integ.name, integ.description, integ.system_type, integ.base_url, integ.status]
      );
    }
    console.log('  ✓ 5 external integrations seeded');

    // ── 2. VAHAN Vehicle Registry ────────────────────────────────────────────
    await client.query('DELETE FROM vahan_vehicles');

    const gujaratRTOs = [
      'RTO Ahmedabad', 'RTO Surat', 'RTO Vadodara', 'RTO Rajkot', 'RTO Gandhinagar',
      'RTO Bhavnagar', 'RTO Jamnagar', 'RTO Junagadh', 'RTO Mehsana', 'RTO Anand',
    ];
    const makes = [
      { make: 'Maruti Suzuki', models: ['Swift', 'Baleno', 'Dzire', 'Brezza', 'Ertiga', 'Alto K10', 'WagonR'] },
      { make: 'Tata Motors', models: ['Nexon', 'Punch', 'Harrier', 'Safari', 'Tiago', 'Altroz'] },
      { make: 'Hyundai', models: ['Creta', 'Venue', 'i20', 'Verna', 'Tucson', 'Alcazar'] },
      { make: 'Mahindra', models: ['Thar', 'XUV700', 'Scorpio-N', 'XUV300', 'Bolero'] },
      { make: 'Toyota', models: ['Fortuner', 'Innova Crysta', 'Urban Cruiser', 'Glanza'] },
      { make: 'Kia', models: ['Seltos', 'Sonet', 'Carens', 'EV6'] },
      { make: 'Honda', models: ['City', 'Amaze', 'Elevate', 'WR-V'] },
    ];
    const colors = ['White', 'Silver', 'Black', 'Grey', 'Red', 'Blue', 'Brown', 'Beige', 'Maroon', 'Green'];
    const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Petrol+CNG'];
    const vehicleTypes = ['Car', 'SUV', 'Sedan', 'Hatchback', 'MPV', 'Pickup'];
    const ownerFirstNames = [
      'Rajesh', 'Amit', 'Suresh', 'Bhavesh', 'Nilesh', 'Hardik', 'Jayesh', 'Prakash',
      'Dharmesh', 'Kiran', 'Meena', 'Priya', 'Deepa', 'Kavita', 'Shilpa', 'Pooja',
      'Tushar', 'Vivek', 'Alpesh', 'Chirag', 'Dhaval', 'Gaurav', 'Hemant', 'Jignesh',
      'Manish', 'Nitin', 'Paresh', 'Rohan', 'Sandip', 'Varun',
    ];
    const ownerLastNames = [
      'Patel', 'Shah', 'Mehta', 'Desai', 'Joshi', 'Pandya', 'Trivedi', 'Dave',
      'Parmar', 'Chauhan', 'Solanki', 'Rathod', 'Thakor', 'Bhatt', 'Raval',
      'Modi', 'Gajjar', 'Mistry', 'Amin', 'Nagar',
    ];

    const vehicles: Array<{
      plate: string; owner: string; make: string; model: string; color: string;
      type: string; regDate: string; insUntil: string; insStatus: string;
      fitnessUntil: string; rto: string; fuel: string; isStolen: boolean;
      stolenFir: string | null; challans: number;
    }> = [];

    // Known watchlist vehicles (must match existing watchlist entries)
    vehicles.push({
      plate: 'GJ01WL0001',
      owner: 'Vikram Singh Rathod',
      make: 'Toyota', model: 'Fortuner', color: 'Black', type: 'SUV',
      regDate: '2023-03-15', insUntil: '2025-03-14', insStatus: 'expired',
      fitnessUntil: '2025-09-30', rto: 'RTO Ahmedabad', fuel: 'Diesel',
      isStolen: true, stolenFir: 'FIR/AHM/2026/04821', challans: 3,
    });
    vehicles.push({
      plate: 'GJ05WL0002',
      owner: 'Ramesh Kumar Jadeja',
      make: 'Mahindra', model: 'Scorpio-N', color: 'White', type: 'SUV',
      regDate: '2022-08-20', insUntil: '2026-08-19', insStatus: 'active',
      fitnessUntil: '2026-12-31', rto: 'RTO Surat', fuel: 'Diesel',
      isStolen: true, stolenFir: 'FIR/SUR/2026/03157', challans: 1,
    });

    // Other plates used in seed data / existing detections
    vehicles.push({
      plate: 'GJ01AB1234',
      owner: 'Amit Patel',
      make: 'Maruti Suzuki', model: 'Swift', color: 'Red', type: 'Hatchback',
      regDate: '2021-06-10', insUntil: '2027-06-09', insStatus: 'active',
      fitnessUntil: '2027-06-09', rto: 'RTO Ahmedabad', fuel: 'Petrol',
      isStolen: false, stolenFir: null, challans: 0,
    });
    vehicles.push({
      plate: 'GJ05CD5678',
      owner: 'Suresh Mehta',
      make: 'Hyundai', model: 'Creta', color: 'White', type: 'SUV',
      regDate: '2022-01-25', insUntil: '2027-01-24', insStatus: 'active',
      fitnessUntil: '2027-01-24', rto: 'RTO Surat', fuel: 'Diesel',
      isStolen: false, stolenFir: null, challans: 2,
    });
    vehicles.push({
      plate: 'GJ18XY9999',
      owner: 'Bhavesh Desai',
      make: 'Tata Motors', model: 'Nexon', color: 'Blue', type: 'SUV',
      regDate: '2023-11-05', insUntil: '2026-11-04', insStatus: 'active',
      fitnessUntil: '2026-11-04', rto: 'RTO Gandhinagar', fuel: 'Petrol+CNG',
      isStolen: false, stolenFir: null, challans: 0,
    });
    vehicles.push({
      plate: 'GJ27ST4321',
      owner: 'Kiran Joshi',
      make: 'Honda', model: 'City', color: 'Silver', type: 'Sedan',
      regDate: '2020-07-18', insUntil: '2026-07-17', insStatus: 'active',
      fitnessUntil: '2026-07-17', rto: 'RTO Junagadh', fuel: 'Petrol',
      isStolen: false, stolenFir: null, challans: 1,
    });
    vehicles.push({
      plate: 'MH12DE3456',
      owner: 'Gaurav Sharma',
      make: 'Kia', model: 'Seltos', color: 'Grey', type: 'SUV',
      regDate: '2023-04-12', insUntil: '2027-04-11', insStatus: 'active',
      fitnessUntil: '2027-04-11', rto: 'RTO Pune (Interstate)', fuel: 'Diesel',
      isStolen: false, stolenFir: null, challans: 0,
    });

    // Generate remaining random vehicles to reach ~50
    const districtCodes = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12',
                           '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24',
                           '25', '26', '27', '28', '29', '30', '31', '32', '33'];
    const usedPlates = new Set(vehicles.map(v => v.plate));

    for (let i = 0; i < 43; i++) {
      let plate: string;
      do {
        const distCode = districtCodes[Math.floor(Math.random() * districtCodes.length)];
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const l1 = letters[Math.floor(Math.random() * letters.length)];
        const l2 = letters[Math.floor(Math.random() * letters.length)];
        const num = String(Math.floor(1000 + Math.random() * 9000));
        plate = `GJ${distCode}${l1}${l2}${num}`;
      } while (usedPlates.has(plate));
      usedPlates.add(plate);

      const makeObj = makes[Math.floor(Math.random() * makes.length)];
      const model = makeObj.models[Math.floor(Math.random() * makeObj.models.length)];
      const regYear = 2019 + Math.floor(Math.random() * 7);
      const regMonth = 1 + Math.floor(Math.random() * 12);
      const regDay = 1 + Math.floor(Math.random() * 28);
      const regDate = `${regYear}-${String(regMonth).padStart(2, '0')}-${String(regDay).padStart(2, '0')}`;
      const insExpYear = regYear + 1 + Math.floor(Math.random() * 3);
      const isInsExpired = insExpYear < 2026 || (insExpYear === 2026 && regMonth < 9);

      vehicles.push({
        plate,
        owner: `${ownerFirstNames[Math.floor(Math.random() * ownerFirstNames.length)]} ${ownerLastNames[Math.floor(Math.random() * ownerLastNames.length)]}`,
        make: makeObj.make,
        model,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)],
        regDate,
        insUntil: `${insExpYear}-${String(regMonth).padStart(2, '0')}-${String(regDay).padStart(2, '0')}`,
        insStatus: isInsExpired ? 'expired' : 'active',
        fitnessUntil: `${insExpYear + 1}-${String(regMonth).padStart(2, '0')}-${String(regDay).padStart(2, '0')}`,
        rto: gujaratRTOs[Math.floor(Math.random() * gujaratRTOs.length)],
        fuel: fuelTypes[Math.floor(Math.random() * fuelTypes.length)],
        isStolen: false,
        stolenFir: null,
        challans: Math.floor(Math.random() * 5),
      });
    }

    for (const v of vehicles) {
      await client.query(
        `INSERT INTO vahan_vehicles (plate_number, owner_name, vehicle_make, vehicle_model, vehicle_color,
         vehicle_type, registration_date, insurance_valid_until, insurance_status, fitness_valid_until,
         rto_office, fuel_type, engine_number, chassis_number, is_stolen, stolen_fir_number, challan_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (plate_number) DO UPDATE SET
           owner_name = EXCLUDED.owner_name,
           vehicle_make = EXCLUDED.vehicle_make,
           vehicle_model = EXCLUDED.vehicle_model,
           is_stolen = EXCLUDED.is_stolen,
           stolen_fir_number = EXCLUDED.stolen_fir_number`,
        [
          v.plate, v.owner, v.make, v.model, v.color, v.type, v.regDate,
          v.insUntil, v.insStatus, v.fitnessUntil, v.rto, v.fuel,
          `ENG${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          `CHS${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
          v.isStolen, v.stolenFir, v.challans,
        ]
      );
    }
    console.log(`  ✓ ${vehicles.length} VAHAN vehicle records seeded`);

    // ── 3. AI Analytics Events (sample data for last 24h) ────────────────────
    await client.query('DELETE FROM ai_analytics_events');

    // Get camera IDs for distributing events
    const camsRes = await client.query(`SELECT id FROM cameras ORDER BY id LIMIT 30`);
    const cameraIds = camsRes.rows.map((r: any) => r.id);

    if (cameraIds.length === 0) {
      console.warn('  ⚠ No cameras found in DB — skipping AI event seeding');
    } else {
      const baseTime = Date.now();
      const eventTypes = ['face_detection', 'crowd_count', 'vehicle_count', 'anomaly'] as const;

      for (let i = 0; i < 200; i++) {
        const camId = cameraIds[Math.floor(Math.random() * cameraIds.length)];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const offsetMin = Math.floor(Math.random() * 1440); // within last 24h
        const timestamp = new Date(baseTime - offsetMin * 60 * 1000);

        let payload: any = {};
        let confidence = +(0.80 + Math.random() * 0.19).toFixed(4);

        switch (eventType) {
          case 'face_detection':
            payload = { faces_count: 1 + Math.floor(Math.random() * 5), bounding_boxes: [] };
            break;
          case 'crowd_count':
            payload = { person_count: 5 + Math.floor(Math.random() * 40), density: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low' };
            break;
          case 'vehicle_count':
            payload = { car: Math.floor(Math.random() * 15), truck: Math.floor(Math.random() * 5), bus: Math.floor(Math.random() * 3), total: 0 };
            payload.total = payload.car + payload.truck + payload.bus;
            break;
          case 'anomaly':
            const anomalyTypes = ['crowd_spike', 'camera_blackout', 'traffic_congestion', 'after_hours_activity'];
            const anomType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
            payload = { type: anomType, severity: Math.random() > 0.6 ? 'high' : 'medium', description: `${anomType.replace(/_/g, ' ')} detected at camera ${camId}` };
            confidence = +(0.85 + Math.random() * 0.14).toFixed(4);
            break;
        }

        await client.query(
          `INSERT INTO ai_analytics_events (camera_id, event_type, confidence, payload, processing_ms, source, occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [camId, eventType, confidence, JSON.stringify(payload), 20 + Math.floor(Math.random() * 80), 'inference', timestamp]
        );
      }
      console.log('  ✓ 200 AI analytics events seeded');
    }

    // ── 4. Sample Integration Queries ────────────────────────────────────────
    const samplePlates = ['GJ01WL0001', 'GJ05CD5678', 'GJ01AB1234', 'GJ18XY9999', 'GJ27ST4321',
                          'GJ05WL0002', 'MH12DE3456', 'GJ01XX0000', 'GJ33ZZ9999', 'GJ10AB5555'];

    // Get a user ID for queried_by
    const userRes = await client.query(`SELECT id FROM users LIMIT 1`);
    const userId = userRes.rows[0]?.id || null;

    for (let i = 0; i < 20; i++) {
      const plate = samplePlates[Math.floor(Math.random() * samplePlates.length)];
      const vehicleMatch = vehicles.find(v => v.plate === plate);
      const offsetMin = Math.floor(Math.random() * 1440);
      const qTime = new Date(Date.now() - offsetMin * 60 * 1000);

      await client.query(
        `INSERT INTO integration_queries (integration_id, query_type, query_input, response_data, status, response_ms, queried_by, created_at)
         VALUES ('vahan', 'plate_lookup', $1, $2, $3, $4, $5, $6)`,
        [
          JSON.stringify({ plate }),
          vehicleMatch ? JSON.stringify({ owner: vehicleMatch.owner, make: vehicleMatch.make, stolen: vehicleMatch.isStolen }) : JSON.stringify({ message: 'Not found' }),
          vehicleMatch ? 'success' : 'not_found',
          15 + Math.floor(Math.random() * 50),
          userId,
          qTime,
        ]
      );
    }
    console.log('  ✓ 20 sample integration queries seeded');

    await client.query('COMMIT');
    console.log('✅ Model 4 Central VMS data seeded successfully!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Model 4 seed error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedModel4();
