import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { AdvancesPage } from '../features/advances/AdvancesPage';
import { LoginPage } from '../features/auth/LoginPage';
import { IncidentsPage } from '../features/incidents/IncidentsPage';
import { QualityPage } from '../features/quality/QualityPage';
import { RolesPage } from '../features/roles/RolesPage';
import { RouteDetailPage } from '../features/routes/RouteDetailPage';
import { RoutesPage } from '../features/routes/RoutesPage';
import { SettlementDetailPage } from '../features/settlements/SettlementDetailPage';
import { SettlementsPage } from '../features/settlements/SettlementsPage';
import { SettlementPreviewPage } from '../features/settlements/SettlementPreviewPage';
import { ShipmentsPage } from '../features/shipments/ShipmentsPage';
import { TariffsPage } from '../features/tariffs/TariffsPage';
import { UsersPage } from '../features/users/UsersPage';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/shipments" element={<ShipmentsPage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/routes/:id" element={<RouteDetailPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/tariffs" element={<TariffsPage />} />
        <Route path="/advances" element={<AdvancesPage />} />
        <Route path="/settlements" element={<SettlementsPage />} />
        <Route path="/settlements/:id" element={<SettlementDetailPage />} />
        <Route path="/settlements/preview" element={<SettlementPreviewPage />} />
        <Route path="/quality" element={<QualityPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/roles" element={<RolesPage />} />
      </Routes>
    </AppShell>
  );
}
