import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/layout/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import DestinationMonitorPage from "./pages/destinations/DestinationMonitorPage";
import DestinationDetailPage from "./pages/destinations/DestinationDetailPage";
import LocalDeviceMonitorPage from "./pages/devices/LocalDeviceMonitorPage";
import LocalDeviceDetailPage from "./pages/devices/LocalDeviceDetailPage";
import RoutersPage from "./pages/routers/RoutersPage";
import RouterDetailPage from "./pages/routers/RouterDetailPage";
import RouterManagementPage from "./pages/management/RouterManagementPage";
import DestinationManagementPage from "./pages/management/DestinationManagementPage";
import LocalDeviceManagementPage from "./pages/management/LocalDeviceManagementPage";
import BulkImportPage from "./pages/management/BulkImportPage";
import UserManagementPage from "./pages/management/UserManagementPage";
import AuditLogPage from "./pages/management/AuditLogPage";
import DestinationReportsPage from "./pages/reports/DestinationReportsPage";
import LocalDeviceReportsPage from "./pages/reports/LocalDeviceReportsPage";
import UptimeReportsPage from "./pages/reports/UptimeReportsPage";
import AlertReportsPage from "./pages/reports/AlertReportsPage";
import SettingsPage from "./pages/settings/SettingsPage";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="monitoring/destinations" element={<DestinationMonitorPage />} />
        <Route path="monitoring/destinations/:id" element={<DestinationDetailPage />} />
        <Route path="monitoring/local-devices" element={<LocalDeviceMonitorPage />} />
        <Route path="monitoring/local-devices/:id" element={<LocalDeviceDetailPage />} />
        <Route path="routers" element={<RoutersPage />} />
        <Route path="routers/:id" element={<RouterDetailPage />} />
        <Route path="management/routers" element={<RouterManagementPage />} />
        <Route path="management/destinations" element={<DestinationManagementPage />} />
        <Route path="management/local-devices" element={<LocalDeviceManagementPage />} />
        <Route path="management/bulk-import" element={<BulkImportPage />} />
        <Route path="management/users" element={<UserManagementPage />} />
        <Route path="management/audit-log" element={<AuditLogPage />} />
        <Route path="reports/destinations" element={<DestinationReportsPage />} />
        <Route path="reports/local-devices" element={<LocalDeviceReportsPage />} />
        <Route path="reports/uptime" element={<UptimeReportsPage />} />
        <Route path="reports/alerts" element={<AlertReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontFamily: "var(--font-sans)", fontSize: "0.85rem" },
        }}
      />
    </AuthProvider>
  );
}
