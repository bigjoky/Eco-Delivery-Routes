import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { AuditOpsPage } from '../features/audit/AuditOpsPage';
import { canAccess } from '../core/auth/access';
import { sessionStore } from '../core/auth/sessionStore';
import { apiClient } from '../services/apiClient';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { LoginPage } from '../features/auth/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { FleetControlsPage } from '../features/fleet/FleetControlsPage';
import { IncidentsPage } from '../features/incidents/IncidentsPage';
import { NetworkPage } from '../features/network/NetworkPage';
import { PartnersPage } from '../features/partners/PartnersPage';
import { CompliancePage } from '../features/compliance/CompliancePage';
import { QualityPage } from '../features/quality/QualityPage';
import { RolesPage } from '../features/roles/RolesPage';
import { RoleDetailPage } from '../features/roles/RoleDetailPage';
import { RouteDetailPage } from '../features/routes/RouteDetailPage';
import { RoutesBoardPage } from '../features/routes/RoutesBoardPage';
import { RoutesPage } from '../features/routes/RoutesPage';
import { SettlementDetailPage } from '../features/settlements/SettlementDetailPage';
import { SettlementsPage } from '../features/settlements/SettlementsPage';
import { SettlementPreviewPage } from '../features/settlements/SettlementPreviewPage';
import { ShipmentsPage } from '../features/shipments/ShipmentsPage';
import { ShipmentDetailPage } from '../features/shipments/ShipmentDetailPage';
import { TariffsPage } from '../features/tariffs/TariffsPage';
import { WorkforcePage } from '../features/workforce/WorkforcePage';
import { UsersPage } from '../features/users/UsersPage';
import { UserDetailPage } from '../features/users/UserDetailPage';

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
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/shipments"
          element={isAuthenticated && canAccess('shipments', roles) ? <ShipmentsPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/shipments/:id"
          element={isAuthenticated && canAccess('shipments', roles) ? <ShipmentDetailPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/routes"
          element={isAuthenticated && canAccess('routes', roles) ? <RoutesPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/routes/board"
          element={isAuthenticated && canAccess('routes', roles) ? <RoutesBoardPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/routes/:id"
          element={isAuthenticated && canAccess('routes', roles) ? <RouteDetailPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/incidents"
          element={isAuthenticated && canAccess('incidents', roles) ? <IncidentsPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/network"
          element={isAuthenticated && canAccess('network', roles) ? <NetworkPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/partners"
          element={isAuthenticated && canAccess('partners', roles) ? <PartnersPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/workforce"
          element={isAuthenticated && canAccess('workforce', roles) ? <WorkforcePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/compliance"
          element={isAuthenticated && canAccess('compliance', roles) ? <CompliancePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/fleet-controls"
          element={isAuthenticated && canAccess('fleet', roles) ? <FleetControlsPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/tariffs"
          element={isAuthenticated && canAccess('tariffs', roles) ? <TariffsPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/advances"
          element={isAuthenticated && canAccess('advances', roles) ? <AdvancesPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/settlements"
          element={isAuthenticated && canAccess('settlements', roles) ? <SettlementsPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/settlements/:id"
          element={isAuthenticated && canAccess('settlements', roles) ? <SettlementDetailPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/settlements/preview"
          element={isAuthenticated && canAccess('settlements', roles) ? <SettlementPreviewPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/quality"
          element={isAuthenticated && canAccess('quality', roles)
            ? (
              <ErrorBoundary fallback={<div className="helper">No se pudo cargar KPI Calidad.</div>}>
                <QualityPage />
              </ErrorBoundary>
            )
            : <Navigate to="/login" replace />}
        />
        <Route
          path="/users"
          element={isAuthenticated && canAccess('users', roles) ? <UsersPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/users/:id"
          element={isAuthenticated && canAccess('users', roles) ? <UserDetailPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/roles"
          element={isAuthenticated && canAccess('roles', roles) ? <RolesPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/roles/:id"
          element={isAuthenticated && canAccess('roles', roles) ? <RoleDetailPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/audit"
          element={isAuthenticated && canAccess('audit', roles) ? <AuditOpsPage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </AppShell>
  );
}
