import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import GISPage from './pages/GISPage';
import RegistryPage from './pages/RegistryPage';
import OnboardingPage from './pages/OnboardingPage';
import GapAnalysisPage from './pages/GapAnalysisPage';
import DepartmentsPage from './pages/DepartmentsPage';
import HealthMonitorPage from './pages/HealthMonitorPage';
import AuditTrailPage from './pages/AuditTrailPage';
import APIDocsPage from './pages/APIDocsPage';
import SettingsPage from './pages/SettingsPage';
// Model 3 Federation pages
import FederationPage from './pages/FederationPage';
import CorrelationPage from './pages/CorrelationPage';
import AdapterDocsPage from './pages/AdapterDocsPage';
import WatchlistPage from './pages/WatchlistPage';
import AlertsPage from './pages/AlertsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />
      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/" element={<GISPage />} />
        <Route path="/cameras" element={<RegistryPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/gap-analysis" element={<GapAnalysisPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/health" element={<HealthMonitorPage />} />
        <Route path="/audit" element={<AuditTrailPage />} />
        <Route path="/registry-api-docs" element={<APIDocsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Model 3 Federation */}
        <Route path="/federation" element={<FederationPage />} />
        <Route path="/correlation" element={<CorrelationPage />} />
        <Route path="/adapter-docs" element={<AdapterDocsPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
