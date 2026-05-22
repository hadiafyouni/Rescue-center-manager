'use client';

export default function AdminUsersPage() {
  // Mock users for the prototype (would fetch from DB in prod)
  const users = [
    { id: 1, username: 'admin_sys', role: 'admin', status: 'active' },
    { id: 2, username: 'dispatcher1', role: 'dispatcher', status: 'active' },
    { id: 3, username: 'crew_amb_01', role: 'unit', status: 'active' },
    { id: 4, username: 'hospital_aub', role: 'hospital', status: 'active' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>System Users</h1>
        <button>+ Invite User</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ color: 'var(--text-muted)' }}>#{u.id}</td>
                <td style={{ fontWeight: 600 }}>{u.username}</td>
                <td style={{ textTransform: 'capitalize' }}>
                  <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                    {u.role}
                  </span>
                </td>
                <td><span className="badge available">Active</span></td>
                <td>
                  <button className="outline" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
