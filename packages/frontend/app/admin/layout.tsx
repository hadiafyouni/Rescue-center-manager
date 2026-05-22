'use client';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { LayoutDashboard, Ambulance, Hospital, Users, Activity } from 'lucide-react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const links = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Units Fleet', href: '/admin/units', icon: Ambulance },
    { name: 'Hospitals', href: '/admin/hospitals', icon: Hospital },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'System Logs', href: '/console/audit', icon: Activity },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.2rem' }}>Dispatch Admin</h2>
        </div>
        <nav className="admin-nav">
          {links.map(link => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <a key={link.href} href={link.href} className={isActive ? 'active' : ''}>
                <Icon size={18} />
                {link.name}
              </a>
            );
          })}
        </nav>
      </aside>
      <main className="admin-content">
        {children}
      </main>
    </div>
  );
}
