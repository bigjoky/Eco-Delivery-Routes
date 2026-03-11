import { Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { canAccess } from '../core/auth/access';
import { sessionStore } from '../core/auth/sessionStore';
import { apiClient } from '../services/apiClient';

const AuditOpsPage = lazy(() => import('../features/audit/AuditOpsPage').then((module) => ({ default: module.AuditOpsPage })));
const AdvancesPage = lazy(() => import('../features/advances/AdvancesPage').then((module) => ({ default: module.AdvancesPage })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const FleetControlsPage = lazy(() => import('../features/fleet/FleetControlsPage').then((module) => ({ default: module.FleetControlsPage })));
const IncidentsPage = lazy(() => import('../features/incidents/IncidentsPage').then((module) => ({ default: module.IncidentsPage })));
const NetworkPage = lazy(() => import('../features/network/NetworkPage').then((module) => ({ default: module.NetworkPage })));
const PartnersPage = lazy(() => import('../features/partners/PartnersPage').then((module) => ({ default: module.PartnersPage })));
const CompliancePage = lazy(() => import('../features/compliance/CompliancePage').then((module) => ({ default: module.CompliancePage })));
const QualityPage = lazy(() => import('../features/quality/QualityPage').then((module) => ({ default: module.QualityPage })));
const RolesPage = lazy(() => import('../features/roles/RolesPage').then((module) => ({ default: module.RolesPage })));
const RoleDetailPage = lazy(() => import('../features/roles/RoleDetailPage').then((module) => ({ default: module.RoleDetailPage })));
const RouteDetailPage = lazy(() => import('../features/routes/RouteDetailPage').then((module) => ({ default: module.RouteDetailPage })));
const RoutesBoardPage = lazy(() => import('../features/routes/RoutesBoardPage').then((module) => ({ default: module.RoutesBoardPage })));
const RoutesPage = lazy(() => import('../features/routes/RoutesPage').then((module) => ({ default: module.RoutesPage })));
const SettlementDetailPage = lazy(() => import('../features/settlements/SettlementDetailPage').then((module) => ({ default: module.SettlementDetailPage })));
const SettlementsPage = lazy(() => import('../features/settlements/SettlementsPage').then((module) => ({ default: module.SettlementsPage })));
const SettlementPreviewPage = lazy(() => import('../features/settlements/SettlementPreviewPage').then((module) => ({ default: module.SettlementPreviewPage })));
const ShipmentsPage = lazy(() => import('../features/shipments/ShipmentsPage').then((module) => ({ default: module.ShipmentsPage })));
const ShipmentDetailPage = lazy(() => import('../features/shipments/ShipmentDetailPage').then((module) => ({ default: module.ShipmentDetailPage })));
const TariffsPage = lazy(() => import('../features/tariffs/TariffsPage').then((module) => ({ default: module.TariffsPage })));
const WorkforcePage = lazy(() => import('../features/workforce/WorkforcePage').then((module) => ({ default: module.WorkforcePage })));
const UsersPage = lazy(() => import('../features/users/UsersPage').then((module) => ({ default: module.UsersPage })));
const UserDetailPage = lazy(() => import('../features/users/UserDetailPage').then((module) => ({ default: module.UserDetailPage })));

function withModuleLoader(element: ReactNode) {
  return (
    <ErrorBoundary fallback={<div className="helper">Se produjo un error al cargar este módulo. Recarga la página.</div>}>
      <Suspense fallback={<div className="status">Cargando módulo...</div>}>
        {element}
      </Suspense>
    </ErrorBoundary>
  );
}

function authLoadingView() {
  return <div className="status">Recuperando sesión...</div>;
}

function ExternalRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return <div className="status">Redirigiendo...</div>;
}

export function App({
  initialSessionUser = null,
}: {
  initialSessionUser?: { id?: string; name?: string; email?: string } | null;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStore.isAuthenticated());
  const [authResolved, setAuthResolved] = useState(false);
  const [roles, setRoles] = useState(sessionStore.getRoles());
  const [currentUser, setCurrentUser] = useState<{ name: string; email?: string } | null>(
    initialSessionUser ? { name: initialSessionUser.name ?? 'Operador', email: initialSessionUser.email } : null
  );

  useEffect(() => {
    let cancelled = false;

    const resolveAuth = async () => {
      try {
        if (initialSessionUser) {
          const profile = await apiClient.bootstrapWebSession();
          if (cancelled) return;
          setCurrentUser({ name: profile.name, email: profile.email });
          setRoles(profile.roles.map((role) => role.code));
          setIsAuthenticated(true);
          return;
        }

        if (sessionStore.getToken()) {
          const profile = await apiClient.getCurrentUser();
          if (cancelled) return;
          setCurrentUser({ name: profile.name, email: profile.email });
          setRoles(profile.roles.map((role) => role.code));
          setIsAuthenticated(true);
          return;
        }

        if (!cancelled) {
          setCurrentUser(null);
          setRoles([]);
          setIsAuthenticated(false);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setRoles([]);
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setAuthResolved(true);
        }
      }
    };

    void resolveAuth();

    return () => {
      cancelled = true;
    };
  }, [initialSessionUser]);

  useEffect(() => {
    sessionStore.syncFromStorage();
    return sessionStore.subscribe(() => {
      setIsAuthenticated(sessionStore.isAuthenticated());
      setRoles(sessionStore.getRoles());
      setAuthResolved(true);
    });
  }, []);

  async function handleLogout() {
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      await fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrf ? { 'X-CSRF-TOKEN': csrf } : undefined,
      });
    } catch {
      // Fallback to API token logout.
      await apiClient.logout().catch(() => undefined);
    } finally {
      sessionStore.setToken(null);
      sessionStore.setRoles([]);
      setCurrentUser(null);
      setAuthResolved(true);
      window.location.href = '/login';
    }
  }

  const protectedRoute = (feature: Parameters<typeof canAccess>[0] | null, element: ReactNode) => {
    if (!authResolved) {
      return authLoadingView();
    }
    if (!isAuthenticated) {
      return <ExternalRedirect href="/login" />;
    }
    if (feature && !canAccess(feature, roles)) {
      return <Navigate to="/dashboard" replace />;
    }
    return withModuleLoader(element);
  };

  return (
    <AppShell isAuthenticated={isAuthenticated} roles={roles} currentUser={currentUser} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={authResolved ? (isAuthenticated ? <Navigate to="/dashboard" replace /> : <ExternalRedirect href="/login" />) : authLoadingView()} />
        <Route path="/dashboard" element={protectedRoute(null, <DashboardPage />)} />
        <Route
          path="/shipments"
          element={protectedRoute('shipments', <ShipmentsPage />)}
        />
        <Route
          path="/shipments/:id"
          element={protectedRoute('shipments', <ShipmentDetailPage />)}
        />
        <Route
          path="/routes"
          element={protectedRoute('routes', <RoutesPage />)}
        />
        <Route
          path="/routes/board"
          element={protectedRoute('routes', <RoutesBoardPage />)}
        />
        <Route
          path="/routes/:id"
          element={protectedRoute('routes', <RouteDetailPage />)}
        />
        <Route
          path="/incidents"
          element={protectedRoute('incidents', <IncidentsPage />)}
        />
        <Route
          path="/network"
          element={protectedRoute('network', <NetworkPage />)}
        />
        <Route
          path="/partners"
          element={protectedRoute('partners', <PartnersPage />)}
        />
        <Route
          path="/workforce"
          element={protectedRoute('workforce', <WorkforcePage />)}
        />
        <Route
          path="/compliance"
          element={protectedRoute('compliance', <CompliancePage />)}
        />
        <Route
          path="/fleet-controls"
          element={protectedRoute('fleet', <FleetControlsPage />)}
        />
        <Route
          path="/tariffs"
          element={protectedRoute('tariffs', <TariffsPage />)}
        />
        <Route
          path="/advances"
          element={protectedRoute('advances', <AdvancesPage />)}
        />
        <Route
          path="/settlements"
          element={protectedRoute('settlements', <SettlementsPage />)}
        />
        <Route
          path="/settlements/:id"
          element={protectedRoute('settlements', <SettlementDetailPage />)}
        />
        <Route
          path="/settlements/preview"
          element={protectedRoute('settlements', <SettlementPreviewPage />)}
        />
        <Route
          path="/quality"
          element={protectedRoute('quality', <QualityPage />)}
        />
        <Route
          path="/users"
          element={protectedRoute('users', <UsersPage />)}
        />
        <Route
          path="/users/:id"
          element={protectedRoute('users', <UserDetailPage />)}
        />
        <Route
          path="/roles"
          element={protectedRoute('roles', <RolesPage />)}
        />
        <Route
          path="/roles/:id"
          element={protectedRoute('roles', <RoleDetailPage />)}
        />
        <Route
          path="/audit"
          element={protectedRoute('audit', <AuditOpsPage />)}
        />
        <Route path="*" element={authResolved ? (isAuthenticated ? <Navigate to="/dashboard" replace /> : <ExternalRedirect href="/login" />) : authLoadingView()} />
      </Routes>
    </AppShell>
  );
}
