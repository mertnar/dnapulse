import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { DataSourcesList } from './pages/DataSourcesList';
import { DataSourceDetail } from './pages/DataSourceDetail';
import { LiveMonitor } from './pages/LiveMonitor';
import { DetectionInvestigation } from './pages/DetectionInvestigation';
import { Agents } from './pages/Agents';
import { AgentsNew } from './pages/AgentsNew';
import { DataModels } from './pages/DataModels';
import { MLModels } from './pages/MLModels';
import { Storage } from './pages/Storage';
import { Authorization } from './pages/Authorization';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/data-sources" element={<DataSourcesList />} />
                      <Route path="/data-sources/:id" element={<DataSourceDetail />} />
                      <Route path="/live-monitor" element={<LiveMonitor />} />
                      <Route path="/detection" element={<DetectionInvestigation />} />
                      <Route path="/agents" element={<AgentsNew />} />
                      <Route path="/agents-old" element={<Agents />} />
                      <Route path="/agents/:id" element={<AgentsNew />} />
                      <Route path="/data-models" element={<DataModels />} />
                      <Route path="/data-models/:id" element={<DataModels />} />
                      <Route path="/ml-models" element={<MLModels />} />
                      <Route path="/ml-models/:id" element={<MLModels />} />
                      <Route path="/storage" element={<Storage />} />
                      <Route path="/authorization" element={<Authorization />} />
                      <Route path="/audit-logs" element={<AuditLogs />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
