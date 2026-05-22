'use client';
import { useEffect, useState } from 'react';

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<any[]>([]);

  useEffect(() => {
    fetch('http://localhost:3002/admin/units')
      .then(res => res.json())
      .then(data => setUnits(data))
      .catch(console.error);
  }, []);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'available': return <span className="badge available">Available</span>;
      case 'en_route': return <span className="badge en_route">En Route</span>;
      case 'on_scene': return <span className="badge busy">On Scene</span>;
      case 'transporting': return <span className="badge busy">Transporting</span>;
      default: return <span className="badge maintenance">{status}</span>;
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Units Fleet</h1>
        <button>+ Add Unit</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Location (Lat, Lon)</th>
              <th>Equipment</th>
            </tr>
          </thead>
          <tbody>
            {units.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>#{u.id}</td>
                <td style={{ textTransform: 'capitalize' }}>{u.type}</td>
                <td>{getStatusBadge(u.status)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{u.lat.toFixed(4)}, {u.lon.toFixed(4)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {u.equipment.map((eq: string) => (
                      <span key={eq} style={{ background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>{eq}</span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No units found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
