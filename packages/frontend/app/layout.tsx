import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Emergency Dispatch System',
  description: 'Nationwide Emergency Dispatch System Prototype',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="nav-brand">🚨 Lebanon Emergency Dispatch</div>
          <div className="nav-links">
            <a href="/intake">Citizen Intake</a>
            <a href="/console">Console</a>
            <a href="/admin" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Admin Portal</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
