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
            <a href="/console">Dispatcher Console</a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
