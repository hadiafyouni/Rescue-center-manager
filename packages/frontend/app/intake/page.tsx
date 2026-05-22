'use client';
import { useState } from 'react';

export default function IntakePage() {
  const [description, setDescription] = useState('');
  const [victimCount, setVictimCount] = useState(1);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [incidentId, setIncidentId] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    // For prototype, we mock geolocation around Beirut
    const mockLocation = { lon: 35.5 + Math.random() * 0.1 - 0.05, lat: 33.88 + Math.random() * 0.1 - 0.05 };
    
    try {
      const res = await fetch('http://localhost:3001/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, victimCount, location: mockLocation })
      });
      if (res.ok) {
        const data = await res.json();
        setIncidentId(data.id);
        setStatus('success');
      } else {
        alert('Submission failed');
        setStatus('idle');
      }
    } catch (err) {
      alert('Network error');
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="card" style={{ display: 'inline-block', maxWidth: '500px' }}>
          <h2 style={{ color: 'var(--success)' }}>Emergency Received</h2>
          <p>Help is on the way. The dispatch team has been notified.</p>
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg)', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Tracking ID</p>
            <p style={{ margin: '0.5rem 0 0', fontWeight: 'bold', fontSize: '1.25rem' }}>#{incidentId}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '600px', paddingTop: '2rem' }}>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Report an Emergency</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Describe the emergency</label>
            <textarea 
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              minLength={10}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
              placeholder="E.g., Heart attack, multi-vehicle crash, structural fire..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estimated Victims</label>
            <input 
              type="number" 
              min={1} 
              value={victimCount}
              onChange={e => setVictimCount(Number(e.target.value))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            />
          </div>
          <button type="submit" disabled={status === 'submitting'} style={{ marginTop: '1rem' }}>
            {status === 'submitting' ? 'Submitting...' : 'Send Emergency Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
