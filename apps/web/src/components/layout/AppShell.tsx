import { Link, NavLink } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';
import { canAccess } from '../../core/auth/access';

const menu = [
  { to: '/', label: 'Login', feature: null },
  { to: '/shipments', label: 'Envios', feature: 'shipments' },
  { to: '/routes', label: 'Rutas', feature: 'routes' },
  { to: '/incidents', label: 'Incidencias', feature: 'incidents' },
  { to: '/partners', label: 'Partners', feature: 'partners' },
  { to: '/tariffs', label: 'Tarifas', feature: 'tariffs' },
  { to: '/advances', label: 'Anticipos', feature: 'advances' },
  { to: '/settlements', label: 'Liquidaciones', feature: 'settlements' },
  { to: '/settlements/preview', label: 'Pre-liquidacion', feature: 'settlements' },
  { to: '/quality', label: 'KPI Calidad', feature: 'quality' },
  { to: '/users', label: 'Usuarios', feature: 'users' },
  { to: '/roles', label: 'Roles', feature: 'roles' },
];

export function AppShell({ children, roles, isAuthenticated }: PropsWithChildren<{ roles: string[]; isAuthenticated: boolean }>) {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const isMock = !apiBase || apiBase === 'undefined' || apiBase === 'null';
  const visibleMenu = menu.filter((item) => {
    if (item.to === '/' && isAuthenticated) return false;
    if (!item.feature) return true;
    if (!isAuthenticated) return false;
    if (isMock && roles.length === 0) return true;
    return canAccess(item.feature, roles);
  });

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="Eco Delivery Routes" className="brand-logo" />
          <span>Eco Delivery Routes TMS</span>
        </Link>
        <nav className="nav-grid" aria-label="Principal">
          {visibleMenu.map((item) => (
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
