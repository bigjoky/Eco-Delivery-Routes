import { Link, NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

const menu = [
  { to: '/', label: 'Login' },
  { to: '/shipments', label: 'Envios' },
  { to: '/routes', label: 'Rutas' },
  { to: '/incidents', label: 'Incidencias' },
  { to: '/tariffs', label: 'Tarifas' },
  { to: '/advances', label: 'Anticipos' },
  { to: '/settlements', label: 'Liquidaciones' },
  { to: '/settlements/preview', label: 'Pre-liquidacion' },
  { to: '/quality', label: 'KPI Calidad' },
  { to: '/users', label: 'Usuarios' },
  { to: '/roles', label: 'Roles' },
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">Eco Delivery Routes TMS</Link>
        <nav className="nav-grid" aria-label="Principal">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn('nav-link', isActive && 'nav-link-active')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
