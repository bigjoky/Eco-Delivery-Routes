import { Link, NavLink, useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';
import { canAccess } from '../../core/auth/access';

const menu = [
  { to: '/', label: 'Login', feature: null },
  { to: '/shipments', label: 'Envios', feature: 'shipments' },
  { to: '/routes', label: 'Rutas', feature: 'routes' },
  { to: '/routes/board', label: 'Rutas Live', feature: 'routes' },
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

const sections = [
  {
    label: 'Operativa',
    items: [
      '/shipments',
      '/routes',
      '/routes/board',
      '/incidents',
      '/partners',
      '/tariffs',
      '/advances',
      '/settlements',
      '/settlements/preview',
      '/quality',
    ],
  },
  {
    label: 'Administracion',
    items: ['/users', '/roles'],
  },
];

export function AppShell({ children, roles, isAuthenticated }: PropsWithChildren<{ roles: string[]; isAuthenticated: boolean }>) {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const isMock = !apiBase || apiBase === 'undefined' || apiBase === 'null';
  const location = useLocation();
  const visibleMenu = menu.filter((item) => {
    if (item.to === '/' && isAuthenticated) return false;
    if (!item.feature) return true;
    if (!isAuthenticated) return false;
    if (isMock && roles.length === 0) return true;
    return canAccess(item.feature, roles);
  });
  const activeItem = visibleMenu.find((item) => location.pathname === item.to) ?? visibleMenu[0];

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="Eco Delivery Routes" className="brand-logo" />
          <span>Eco Delivery Routes</span>
        </Link>
        <nav className="sidebar-nav" aria-label="Principal">
          {sections.map((section) => {
            const sectionItems = visibleMenu.filter((item) => section.items.includes(item.to));
            if (sectionItems.length === 0) return null;
            return (
              <div key={section.label} className="sidebar-group">
                <div className="sidebar-group-title">{section.label}</div>
                {sectionItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div>
            <div className="topbar-title">{activeItem?.label ?? 'Panel'}</div>
            <div className="topbar-subtitle">Eco Delivery Routes TMS</div>
          </div>
          <div className="topbar-actions">
            <span className="helper">{isAuthenticated ? 'Sesión activa' : 'No autenticado'}</span>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
