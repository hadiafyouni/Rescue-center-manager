import { FastifyInstance } from 'fastify';
import { pool } from '../db/pool';

export async function adminRoutes(fastify: FastifyInstance) {
  
  fastify.get('/admin/stats', async (request, reply) => {
    const client = await pool.connect();
    try {
      const incidentsRes = await client.query('SELECT COUNT(*) as total FROM incidents');
      const unitsRes = await client.query('SELECT COUNT(*) as total FROM units WHERE status != $1', ['maintenance']);
      const hospitalsRes = await client.query('SELECT SUM(icu_beds) as total_icu FROM hospitals');
      
      return {
        totalIncidents: parseInt(incidentsRes.rows[0].total),
        activeUnits: parseInt(unitsRes.rows[0].total),
        availableIcuBeds: parseInt(hospitalsRes.rows[0].total_icu) || 0
      };
    } finally {
      client.release();
    }
  });

  fastify.get('/admin/units', async (request, reply) => {
    const res = await pool.query(`
      SELECT id, type, equipment, status, ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat 
      FROM units 
      ORDER BY id ASC
    `);
    return res.rows;
  });

  fastify.get('/admin/hospitals', async (request, reply) => {
    const res = await pool.query(`
      SELECT id, name, trauma_level, burn_unit, icu_beds, 
             ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat 
      FROM hospitals 
      ORDER BY name ASC
    `);
    return res.rows;
  });
}
