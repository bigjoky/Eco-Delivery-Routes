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
const LoginPage = lazy(() => import('../features/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
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
    <Suspense fallback={<div className="status">Cargando módulo...</div>}>
      {element}
    </Suspense>
  );
}

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStore.isAuthenticated());
  const [roles, setRoles] = useState(sessionStore.getRoles());
  const [currentUser, setCurrentUser] = useState<{ name: string; email?: string } | null>(null);

  useEffect(() => {
    apiClient.getCurrentUser().then((profile) => {
      setCurrentUser({ name: profile.name, email: profile.email });
      setRoles(profile.roles.map((role) => role.code));
      setIsAuthenticated(true);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    sessionStore.syncFromStorage();
    return sessionStore.subscribe(() => {
      setIsAuthenticated(sessionStore.isAuthenticated());
      setRoles(sessionStore.getRoles());
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated || roles.length > 0) return;
    apiClient.getCurrentUser().then((profile) => {
      setCurrentUser({ name: profile.name, email: profile.email });
      setRoles(profile.roles.map((role) => role.code));
      setIsAuthenticated(true);
    }).catch(() => undefined);
  }, [isAuthenticated, roles.length]);

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
      window.location.href = '/login';
    }
  }

  return (
    <AppShell isAuthenticated={isAuthenticated} roles={roles} currentUser={currentUser} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={withModuleLoader(<LoginPage />)} />
        <Route
          path="/dashboard"
          element={isAuthenticated ? withModuleLoader(<DashboardPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/shipments"
          element={isAuthenticated && canAccess('shipments', roles) ? withModuleLoader(<ShipmentsPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/shipments/:id"
          element={isAuthenticated && canAccess('shipments', roles) ? withModuleLoader(<ShipmentDetailPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/routes"
          element={isAuthenticated && canAccess('routes', roles) ? withModuleLoader(<RoutesPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/routes/board"
          element={isAuthenticated && canAccess('routes', roles) ? withModuleLoader(<RoutesBoardPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/routes/:id"
          element={isAuthenticated && canAccess('routes', roles) ? withModuleLoader(<RouteDetailPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/incidents"
          element={isAuthenticated && canAccess('incidents', roles) ? withModuleLoader(<IncidentsPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/network"
          element={isAuthenticated && canAccess('network', roles) ? withModuleLoader(<NetworkPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/partners"
          element={isAuthenticated && canAccess('partners', roles) ? withModuleLoader(<PartnersPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/workforce"
          element={isAuthenticated && canAccess('workforce', roles) ? withModuleLoader(<WorkforcePage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/compliance"
          element={isAuthenticated && canAccess('compliance', roles) ? withModuleLoader(<CompliancePage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/fleet-controls"
          element={isAuthenticated && canAccess('fleet', roles) ? withModuleLoader(<FleetControlsPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/tariffs"
          element={isAuthenticated && canAccess('tariffs', roles) ? withModuleLoader(<TariffsPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/advances"
          element={isAuthenticated && canAccess('advances', roles) ? withModuleLoader(<AdvancesPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/settlements"
          element={isAuthenticated && canAccess('settlements', roles) ? withModuleLoader(<SettlementsPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/settlements/:id"
          element={isAuthenticated && canAccess('settlements', roles) ? withModuleLoader(<SettlementDetailPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/settlements/preview"
          element={isAuthenticated && canAccess('settlements', roles) ? withModuleLoader(<SettlementPreviewPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/quality"
          element={isAuthenticated && canAccess('quality', roles)
            ? (
              <ErrorBoundary fallback={<div className="helper">No se pudo cargar KPI Calidad.</div>}>
                {withModuleLoader(<QualityPage />)}
              </ErrorBoundary>
            )
            : <Navigate to="/login" replace />}
        />
        <Route
          path="/users"
          element={isAuthenticated && canAccess('users', roles) ? withModuleLoader(<UsersPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/users/:id"
          element={isAuthenticated && canAccess('users', roles) ? withModuleLoader(<UserDetailPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/roles"
          element={isAuthenticated && canAccess('roles', roles) ? withModuleLoader(<RolesPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/roles/:id"
          element={isAuthenticated && canAccess('roles', roles) ? withModuleLoader(<RoleDetailPage />) : <Navigate to="/login" replace />}
        />
        <Route
          path="/audit"
          element={isAuthenticated && canAccess('audit', roles) ? withModuleLoader(<AuditOpsPage />) : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </AppShell>
  );
}
