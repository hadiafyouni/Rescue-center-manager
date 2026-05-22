export default function Page() {
  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', background: 'linear-gradient(to right, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
          Emergency Dispatch System
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', marginBottom: '2rem' }}>
          Nationwide prototype for intelligent, deterministic dispatching.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <a href="/intake"><button>Submit Emergency (Citizen)</button></a>
          <a href="/console"><button style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>Dispatcher Console</button></a>
        </div>
      </div>
    </div>
  );
}
