import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState, type PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';
import { canAccess } from '../../core/auth/access';

const menu = [
  { to: '/login', label: 'Login', feature: null },
  { to: '/dashboard', label: 'Dashboard', feature: null },
  { to: '/shipments', label: 'Envios', feature: 'shipments' },
  { to: '/routes', label: 'Rutas', feature: 'routes' },
  { to: '/routes/board', label: 'Rutas Live', feature: 'routes' },
  { to: '/incidents', label: 'Incidencias', feature: 'incidents' },
  { to: '/network', label: 'Red Operativa', feature: 'network' },
  { to: '/partners', label: 'Partners', feature: 'partners' },
  { to: '/workforce', label: 'Personal', feature: 'workforce' },
  { to: '/compliance', label: 'CAE y Documentos', feature: 'compliance' },
  { to: '/fleet-controls', label: 'Control de Flota', feature: 'fleet' },
  { to: '/tariffs', label: 'Tarifas', feature: 'tariffs' },
  { to: '/advances', label: 'Anticipos', feature: 'advances' },
  { to: '/settlements', label: 'Liquidaciones', feature: 'settlements' },
  { to: '/settlements/preview', label: 'Pre-liquidacion', feature: 'settlements' },
  { to: '/quality', label: 'KPI Calidad', feature: 'quality' },
  { to: '/users', label: 'Usuarios', feature: 'users' },
  { to: '/roles', label: 'Roles', feature: 'roles' },
  { to: '/audit', label: 'Auditoria', feature: 'audit' },
];

const sections = [
  {
    label: 'Operativa',
    items: [
      '/dashboard',
      '/shipments',
      '/routes',
      '/routes/board',
      '/incidents',
      '/network',
      '/partners',
      '/workforce',
      '/compliance',
      '/fleet-controls',
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

export function AppShell({
  children,
  roles,
  isAuthenticated,
  currentUser,
  onLogout,
}: PropsWithChildren<{
  roles: string[];
  isAuthenticated: boolean;
  currentUser?: { name: string; email?: string } | null;
  onLogout?: () => Promise<void> | void;
}>) {
  const [showAdminMore, setShowAdminMore] = useState(false);
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const isMock = !apiBase || apiBase === 'undefined' || apiBase === 'null';
  const location = useLocation();
  const canAccessOpenApi = roles.includes('super_admin') || roles.includes('admin');
  const visibleMenu = menu.filter((item) => {
    if (item.to === '/login' && isAuthenticated) return false;
    if (!item.feature) return true;
    if (!isAuthenticated) return false;
    if (isMock && roles.length === 0) return true;
    return canAccess(item.feature, roles);
  });
  const activeItem = visibleMenu.find((item) => location.pathname === item.to) ?? visibleMenu[0];
  const auditItem = visibleMenu.find((item) => item.to === '/audit');

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
                {section.label === 'Administracion' && auditItem ? (
                  <details className="sidebar-more" open={showAdminMore} onToggle={(event) => setShowAdminMore((event.currentTarget as HTMLDetailsElement).open)}>
                    <summary className="sidebar-link">Más</summary>
                    <div className="sidebar-more-items">
                      <NavLink
                        to={auditItem.to}
                        className={({ isActive }) => cn('sidebar-link', isActive && 'sidebar-link-active')}
                      >
                        {auditItem.label}
                      </NavLink>
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-name">{currentUser?.name ?? 'Operador'}</div>
            <div className="sidebar-user-email">{currentUser?.email ?? 'Sesion activa'}</div>
            <div className="sidebar-user-actions">
              {canAccessOpenApi ? (
                <a href="/api-docs" className="sidebar-user-link">OpenAPI</a>
              ) : null}
              <a href="/profile" className="sidebar-user-link">Perfil</a>
              <button
                type="button"
                className="sidebar-user-link sidebar-user-button"
                onClick={() => {
                  void onLogout?.();
                }}
              >
                Cerrar sesion
              </button>
            </div>
          </div>
        </div>
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
