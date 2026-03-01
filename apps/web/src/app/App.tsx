import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { canAccess } from '../core/auth/access';
import { sessionStore } from '../core/auth/sessionStore';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { LoginPage } from '../features/auth/LoginPage';
import { IncidentsPage } from '../features/incidents/IncidentsPage';
import { PartnersPage } from '../features/partners/PartnersPage';
import { QualityPage } from '../features/quality/QualityPage';
import { RolesPage } from '../features/roles/RolesPage';
import { RoleDetailPage } from '../features/roles/RoleDetailPage';
import { RouteDetailPage } from '../features/routes/RouteDetailPage';
import { RoutesPage } from '../features/routes/RoutesPage';
import { SettlementDetailPage } from '../features/settlements/SettlementDetailPage';
import { SettlementsPage } from '../features/settlements/SettlementsPage';
import { SettlementPreviewPage } from '../features/settlements/SettlementPreviewPage';
import { ShipmentsPage } from '../features/shipments/ShipmentsPage';
import { TariffsPage } from '../features/tariffs/TariffsPage';
import { UsersPage } from '../features/users/UsersPage';
import { UserDetailPage } from '../features/users/UserDetailPage';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStore.isAuthenticated());
  const [roles, setRoles] = useState(sessionStore.getRoles());

  useEffect(() => {
    return sessionStore.subscribe(() => {
      setIsAuthenticated(sessionStore.isAuthenticated());
      setRoles(sessionStore.getRoles());
    });
  }, []);

  return (
    <AppShell isAuthenticated={isAuthenticated} roles={roles}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/shipments"
          element={isAuthenticated && canAccess('shipments', roles) ? <ShipmentsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/routes"
          element={isAuthenticated && canAccess('routes', roles) ? <RoutesPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/routes/:id"
          element={isAuthenticated && canAccess('routes', roles) ? <RouteDetailPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/incidents"
          element={isAuthenticated && canAccess('incidents', roles) ? <IncidentsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/partners"
          element={isAuthenticated && canAccess('partners', roles) ? <PartnersPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/tariffs"
          element={isAuthenticated && canAccess('tariffs', roles) ? <TariffsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/advances"
          element={isAuthenticated && canAccess('advances', roles) ? <AdvancesPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/settlements"
          element={isAuthenticated && canAccess('settlements', roles) ? <SettlementsPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/settlements/:id"
          element={isAuthenticated && canAccess('settlements', roles) ? <SettlementDetailPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/settlements/preview"
          element={isAuthenticated && canAccess('settlements', roles) ? <SettlementPreviewPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/quality"
          element={isAuthenticated && canAccess('quality', roles) ? <QualityPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/users"
          element={isAuthenticated && canAccess('users', roles) ? <UsersPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/users/:id"
          element={isAuthenticated && canAccess('users', roles) ? <UserDetailPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/roles"
          element={isAuthenticated && canAccess('roles', roles) ? <RolesPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/roles/:id"
          element={isAuthenticated && canAccess('roles', roles) ? <RoleDetailPage /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/shipments' : '/'} replace />} />
      </Routes>
    </AppShell>
  );
}
