import { pool } from './pool';
import fs from 'fs';
import path from 'path';

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log('Running schema migration...');
    const schema = fs.readFileSync(path.join(__dirname, 'migrations', '001_initial_schema.sql'), 'utf-8');
    await client.query(schema);

    console.log('Seeding users...');
    // In dev prototype, password hashes are just plain strings for simplicity.
    await client.query(`
      INSERT INTO users (username, password_hash, role) VALUES
      ('dispatcher1', 'dispatch123', 'dispatcher'),
      ('crew_amb_01', 'crew123', 'unit'),
      ('hospital_aub', 'hosp123', 'hospital')
      ON CONFLICT (username) DO NOTHING;
    `);

    console.log('Seeding hospitals...');
    // Seed ~15 hospitals across Lebanon
    const hospitals = [
      { name: 'AUB Medical Center (Beirut)', lon: 35.4831, lat: 33.8998, trauma: true, burn: true, icu: 10, avail: 10 },
      { name: 'Rizk Hospital (Beirut)', lon: 35.5133, lat: 33.8821, trauma: true, burn: false, icu: 5, avail: 5 },
      { name: 'Hotel Dieu (Beirut)', lon: 35.5186, lat: 33.8781, trauma: true, burn: true, icu: 15, avail: 12 },
      { name: 'Saint George Hospital (Beirut)', lon: 35.5161, lat: 33.8931, trauma: true, burn: false, icu: 8, avail: 2 },
      { name: 'Nini Hospital (Tripoli)', lon: 35.8273, lat: 34.4367, trauma: true, burn: false, icu: 6, avail: 6 },
      { name: 'Albert Haykel Hospital (Tripoli)', lon: 35.8234, lat: 34.4285, trauma: true, burn: false, icu: 5, avail: 1 },
      { name: 'Hammoud Hospital (Sidon)', lon: 35.3724, lat: 33.5615, trauma: true, burn: true, icu: 12, avail: 10 },
      { name: 'Lebanese Italian Hospital (Tyre)', lon: 35.2107, lat: 33.2750, trauma: false, burn: false, icu: 4, avail: 4 },
      { name: 'Jabal Amel Hospital (Tyre)', lon: 35.2078, lat: 33.2701, trauma: true, burn: false, icu: 6, avail: 3 },
      { name: 'Khoury Hospital (Zahle)', lon: 35.9015, lat: 33.8436, trauma: true, burn: false, icu: 8, avail: 7 },
      { name: 'Tel Chiha Hospital (Zahle)', lon: 35.8973, lat: 33.8504, trauma: false, burn: false, icu: 4, avail: 4 },
      { name: 'Dar Al Amal University Hospital (Baalbek)', lon: 36.1991, lat: 34.0044, trauma: true, burn: false, icu: 8, avail: 5 },
      { name: 'Riyak Hospital (Bekaa)', lon: 35.9922, lat: 33.8550, trauma: true, burn: false, icu: 5, avail: 2 },
      { name: 'Mount Lebanon Hospital (Hazmieh)', lon: 35.5381, lat: 33.8586, trauma: true, burn: true, icu: 15, avail: 15 },
      { name: 'Notre Dame des Secours (Jbeil)', lon: 35.6552, lat: 34.1230, trauma: true, burn: false, icu: 6, avail: 4 }
    ];

    for (const h of hospitals) {
      await client.query(`
        INSERT INTO hospitals (name, location, trauma_capable, burn_unit, icu_capacity, icu_available)
        VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5, $6, $7)
      `, [h.name, h.lon, h.lat, h.trauma, h.burn, h.icu, h.avail]);
    }

    console.log('Seeding ambulances...');
    // Seed ~30 ambulances mostly clustered near the hospitals
    for (let i = 1; i <= 30; i++) {
      const h = hospitals[i % hospitals.length];
      // Add slight offset for base station
      const lon = h.lon + (Math.random() * 0.01 - 0.005);
      const lat = h.lat + (Math.random() * 0.01 - 0.005);
      const equip = i % 3 === 0 ? 'ALS' : 'BLS';
      const crew = i % 3 === 0 ? 'paramedic' : 'emt';
      
      await client.query(`
        INSERT INTO ambulances (base_station_location, equipment_level, crew_level, status, last_known_position)
        VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, 'available', ST_SetSRID(ST_MakePoint($1, $2), 4326))
      `, [lon, lat, equip, crew]);
    }

    console.log('Seeding firefighter units...');
    for (let i = 1; i <= 15; i++) {
      const h = hospitals[i % hospitals.length];
      const lon = h.lon + (Math.random() * 0.02 - 0.01);
      const lat = h.lat + (Math.random() * 0.02 - 0.01);
      
      await client.query(`
        INSERT INTO firefighter_units (station_location, available_trucks, specialization, status, last_known_position)
        VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, 'available', ST_SetSRID(ST_MakePoint($1, $2), 4326))
      `, [lon, lat, 2, '{structural,brush}']);
    }

    console.log('Seeding rescue centers...');
    const rescueCenters = [
      { lon: 35.5000, lat: 33.8900 },
      { lon: 35.8300, lat: 34.4300 },
      { lon: 35.3700, lat: 33.5600 },
      { lon: 35.9000, lat: 33.8400 },
      { lon: 35.2100, lat: 33.2700 }
    ];
    for (const r of rescueCenters) {
      await client.query(`
        INSERT INTO rescue_centers (location, vehicle_inventory, staffing)
        VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4)
      `, [r.lon, r.lat, JSON.stringify({ heavy_rescue: 1, zodiac: 2 }), 10]);
    }

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

runSeed();
