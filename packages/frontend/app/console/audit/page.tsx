'use client';

export default function AuditDashboard() {
  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>System Audit Log</h1>
      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '1rem 0' }}>Timestamp</th>
              <th style={{ padding: '1rem 0' }}>Actor</th>
              <th style={{ padding: '1rem 0' }}>Action</th>
              <th style={{ padding: '1rem 0' }}>Entity</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '1rem 0', color: 'var(--text-muted)' }}>Just now</td>
              <td style={{ padding: '1rem 0' }}>System</td>
              <td style={{ padding: '1rem 0' }}>dispatch_auto</td>
              <td style={{ padding: '1rem 0' }}>Incident #42</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
