import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { sessionStore } from '../core/auth/sessionStore';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { LoginPage } from '../features/auth/LoginPage';
import { IncidentsPage } from '../features/incidents/IncidentsPage';
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

  useEffect(() => {
    return sessionStore.subscribe(() => {
      setIsAuthenticated(sessionStore.isAuthenticated());
    });
  }, []);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/shipments" element={isAuthenticated ? <ShipmentsPage /> : <Navigate to="/" replace />} />
        <Route path="/routes" element={isAuthenticated ? <RoutesPage /> : <Navigate to="/" replace />} />
        <Route path="/routes/:id" element={isAuthenticated ? <RouteDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/incidents" element={isAuthenticated ? <IncidentsPage /> : <Navigate to="/" replace />} />
        <Route path="/tariffs" element={isAuthenticated ? <TariffsPage /> : <Navigate to="/" replace />} />
        <Route path="/advances" element={isAuthenticated ? <AdvancesPage /> : <Navigate to="/" replace />} />
        <Route path="/settlements" element={isAuthenticated ? <SettlementsPage /> : <Navigate to="/" replace />} />
        <Route path="/settlements/:id" element={isAuthenticated ? <SettlementDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/settlements/preview" element={isAuthenticated ? <SettlementPreviewPage /> : <Navigate to="/" replace />} />
        <Route path="/quality" element={isAuthenticated ? <QualityPage /> : <Navigate to="/" replace />} />
        <Route path="/users" element={isAuthenticated ? <UsersPage /> : <Navigate to="/" replace />} />
        <Route path="/users/:id" element={isAuthenticated ? <UserDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/roles" element={isAuthenticated ? <RolesPage /> : <Navigate to="/" replace />} />
        <Route path="/roles/:id" element={isAuthenticated ? <RoleDetailPage /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/shipments' : '/'} replace />} />
      </Routes>
    </AppShell>
  );
}
