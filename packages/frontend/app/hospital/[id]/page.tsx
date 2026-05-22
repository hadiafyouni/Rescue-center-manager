'use client';
import { useState } from 'react';

export default function HospitalView({ params }: { params: { id: string } }) {
  const [icuAvailable, setIcuAvailable] = useState(5);
  const [accepting, setAccepting] = useState(true);

  return (
    <div className="container" style={{ maxWidth: '800px', paddingTop: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Hospital #{params.id} Portal</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="checkbox" 
              checked={accepting} 
              onChange={e => setAccepting(e.target.checked)} 
              style={{ width: '1.2rem', height: '1.2rem' }}
            />
            Accepting Patients
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Capacity</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span>ICU Beds Available</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setIcuAvailable(v => Math.max(0, v - 1))} style={{ padding: '0.25rem 0.75rem' }}>-</button>
              <span style={{ fontWeight: 'bold', fontSize: '1.2rem', width: '2rem', textAlign: 'center' }}>{icuAvailable}</span>
              <button onClick={() => setIcuAvailable(v => v + 1)} style={{ padding: '0.25rem 0.75rem' }}>+</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Incoming Patients</h3>
          <p style={{ color: 'var(--text-muted)' }}>No incoming patients right now.</p>
          {/* Incoming patients list would populate here via WebSockets */}
        </div>
      </div>
    </div>
  );
}
