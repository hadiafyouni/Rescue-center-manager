'use client';
import { useEffect, useState } from 'react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalIncidents: 0, activeUnits: 0, availableIcuBeds: 0 });

  useEffect(() => {
    fetch('http://localhost:3002/admin/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Overview</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Total Incidents Processed</h3>
          <p className="text-gradient" style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0' }}>{stats.totalIncidents}</p>
        </div>
        
        <div className="card">
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Active Fleet Units</h3>
          <p className="text-gradient" style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0' }}>{stats.activeUnits}</p>
        </div>
        
        <div className="card">
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Available ICU Beds</h3>
          <p className="text-gradient" style={{ fontSize: '3rem', fontWeight: 800, margin: '0.5rem 0 0' }}>{stats.availableIcuBeds}</p>
        </div>
      </div>

      <div className="card">
        <h2>System Status</h2>
        <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-success)', boxShadow: '0 0 10px var(--status-success)' }} />
            <span>Database (PostgreSQL 15)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-success)', boxShadow: '0 0 10px var(--status-success)' }} />
            <span>PubSub (Redis 7)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-success)', boxShadow: '0 0 10px var(--status-success)' }} />
            <span>Routing (OSRM)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
