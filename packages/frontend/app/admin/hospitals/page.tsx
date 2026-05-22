'use client';
import { useEffect, useState } from 'react';

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3002/admin/hospitals')
      .then(res => res.json())
      .then(data => setHospitals(data))
      .catch(console.error);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Hospitals Network</h1>
        <button>+ Add Hospital</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Hospital Name</th>
              <th>Trauma Level</th>
              <th>Burn Unit</th>
              <th>Available ICU Beds</th>
              <th>Location (Lat, Lon)</th>
            </tr>
          </thead>
          <tbody>
            {hospitals.map(h => (
              <tr key={h.id}>
                <td style={{ fontWeight: 600 }}>{h.name}</td>
                <td>{h.trauma_level || 'N/A'}</td>
                <td>
                  {h.burn_unit ? <span className="badge available">Yes</span> : <span className="badge maintenance">No</span>}
                </td>
                <td>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: h.icu_beds > 0 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {h.icu_beds}
                  </span>
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{h.lat.toFixed(4)}, {h.lon.toFixed(4)}</td>
              </tr>
            ))}
            {hospitals.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hospitals found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
