'use client';
import { useState, useEffect } from 'react';

export default function UnitMobileView({ params }: { params: { id: string } }) {
  const [position, setPosition] = useState<{ lon: number, lat: number } | null>(null);
  const [status, setStatus] = useState<string>('available');

  useEffect(() => {
    // Mock navigator.geolocation for prototype
    const interval = setInterval(() => {
      setPosition({ lon: 35.5 + Math.random() * 0.01, lat: 33.8 + Math.random() * 0.01 });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container" style={{ maxWidth: '400px', paddingTop: '1rem' }}>
      <div className="card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Unit #{params.id}</h2>
        <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: '8px', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)' }}>Status</p>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)' }}>{status.toUpperCase()}</p>
        </div>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          GPS: {position ? `${position.lon.toFixed(4)}, ${position.lat.toFixed(4)}` : 'Acquiring...'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button onClick={() => setStatus('en_route')} disabled={status !== 'assigned'}>En Route</button>
          <button onClick={() => setStatus('on_scene')} disabled={status !== 'en_route'}>On Scene</button>
          <button onClick={() => setStatus('transporting')} disabled={status !== 'on_scene'}>Transporting</button>
          <button onClick={() => setStatus('available')} disabled={status !== 'transporting'} style={{ background: 'var(--success)' }}>Completed</button>
        </div>
      </div>
    </div>
  );
}
