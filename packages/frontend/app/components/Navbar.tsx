'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const tabs = [
    { name: 'Citizen Intake', path: '/intake' },
    { name: 'Console', path: '/console' },
    { name: 'Admin Portal', path: '/admin' }
  ];

  return (
    <nav className="modern-navbar">
      <div className="nav-brand">
        <span className="nav-logo">🚨</span>
        Lebanon Emergency Dispatch
      </div>
      
      <div className="nav-tabs">
        {tabs.map((tab) => {
          // Highlight if current path starts with tab.path
          const isActive = pathname.startsWith(tab.path);
          return (
            <Link 
              key={tab.path} 
              href={tab.path}
              className={`nav-tab ${isActive ? 'active' : ''}`}
            >
              {tab.name}
              {isActive && <span className="nav-tab-indicator" />}
            </Link>
          );
        })}
      </div>

      {/* Spacer for flex layout to keep tabs centered if desired, or user profile space */}
      <div style={{ width: '300px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <div className="user-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' }} />
      </div> 
    </nav>
  );
}
