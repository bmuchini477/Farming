import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthProvider";
import AppShell from "./components/AppShell";

import LoginPage from "./features/auth/LoginPage";
import SignupPage from "./features/auth/SignupPage";
import LandingPage from "./features/auth";
import DashboardPage from "./features/crops/DashboardPage";
import AddCropPage from "./features/crops/AddCropPage";
import CropDetailPage from "./features/crops/CropDetailPage";
import FieldAnalyticsPage from "./features/crops/FieldAnalyticsPage";
import FieldMonitoringHubPage from "./features/crops/FieldMonitoringHubPage";
import HistoryRecordsPage from "./features/crops/HistoryRecordsPage";
import HistoryRecordDetailPage from "./features/crops/HistoryRecordDetailPage";
import ProjectionPage from "./features/crops/ProjectionPage";
import ReportsPage from "./features/reports/ReportsPage";
import AddFarmPage from "./features/farms/AddFarmPage";
import ProfilePage from "./features/profile/ProfilePage";
import WeatherPage from "./features/weather/WeatherPage";
import UsersPage from "./features/users/UsersPage";
import UserDetailPage from "./features/users/UserDetailPage";
import { RequireAuth } from "./features/auth/RequireAuth";
import { RequireVerified } from "./features/auth/RequireVerified";
import EmailVerificationPage from "./features/auth/EmailVerificationPage";
import AccountPendingPage from "./features/auth/AccountPendingPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          
          <Route 
            path="/verify-email" 
            element={
              <RequireAuth>
                <EmailVerificationPage />
              </RequireAuth>
            } 
          />
          
          <Route 
            path="/account-pending" 
            element={
              <RequireAuth>
                <AccountPendingPage />
              </RequireAuth>
            } 
          />

          <Route
            path="/app"
            element={
              <RequireAuth>
                <RequireVerified>
                  <AppShell />
                </RequireVerified>
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="farms/new" element={<AddFarmPage />} />
            <Route path="crops/new" element={<AddCropPage />} />
            <Route path="crops/:id" element={<CropDetailPage />} />
            <Route path="monitoring" element={<FieldMonitoringHubPage />} />
            <Route path="history/:type" element={<HistoryRecordsPage />} />
            <Route path="history/:type/:recordId" element={<HistoryRecordDetailPage />} />
            <Route path="projection" element={<ProjectionPage />} />
            <Route path="fields/analytics" element={<FieldAnalyticsPage />} />
            <Route path="fields/:farmId/analytics" element={<FieldAnalyticsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="weather" element={<WeatherPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
