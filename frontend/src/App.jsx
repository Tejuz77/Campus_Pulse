import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layouts
import StudentLayout from './layouts/StudentLayout';
import StaffLayout from './layouts/StaffLayout';
import AdminLayout from './layouts/AdminLayout';

// Public pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Student pages
import StudentDashboard from './pages/student/StudentDashboard';
import ReportIssuePage from './pages/student/ReportIssuePage';
import MyTicketsPage from './pages/student/MyTicketsPage';
import TicketDetailPage from './pages/student/TicketDetailPage';

// Staff pages
import StaffDashboard from './pages/staff/StaffDashboard';
import StaffTicketsPage from './pages/staff/StaffTicketsPage';
import StaffTicketDetailPage from './pages/staff/StaffTicketDetailPage';

// Admin pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminTickets from './pages/admin/AdminTickets';
import AdminTicketDetail from './pages/admin/AdminTicketDetail';
import AdminStaff from './pages/admin/AdminStaff';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminLocations from './pages/admin/AdminLocations';
import AdminPendingLocations from './pages/admin/AdminPendingLocations';
import AdminEscalated from './pages/admin/AdminEscalated';
import AdminUnassigned from './pages/admin/AdminUnassigned';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAuditLog from './pages/admin/AdminAuditLog';
import AdminSettings from './pages/admin/AdminSettings';

// Shared pages
import NotificationsPage from './pages/shared/NotificationsPage';

// Placeholder for categories (simple version)
function AdminCategories() {
  return (
    <div className="glass-card animate-fade-in">
      <h1 className="page-title">Categories</h1>
      <p className="text-slate-400 mt-2">Category management is available via the seed script. Use the backend API directly to create or update categories.</p>
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="spinner text-indigo-400 w-8 h-8 border-4" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user.role === 'STAFF') return <Navigate to="/staff" replace />;
  return <Navigate to="/student" replace />;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.1)' },
          success: { iconTheme: { primary: '#10b981', secondary: '#1e293b' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
        }}
      />
      <Routes>
        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Student */}
        <Route element={<ProtectedRoute roles={['STUDENT']} />}>
          <Route element={<StudentLayout />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/report" element={<ReportIssuePage />} />
            <Route path="/student/tickets" element={<MyTicketsPage />} />
            <Route path="/student/tickets/:ticketNumber" element={<TicketDetailPage />} />
            <Route path="/student/notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        {/* Staff */}
        <Route element={<ProtectedRoute roles={['STAFF']} />}>
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<StaffDashboard />} />
            <Route path="/staff/tickets" element={<StaffTicketsPage />} />
            <Route path="/staff/tickets/:id" element={<StaffTicketDetailPage />} />
            <Route path="/staff/notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminOverview />} />
            <Route path="/admin/tickets" element={<AdminTickets />} />
            <Route path="/admin/tickets/:id" element={<AdminTicketDetail />} />
            <Route path="/admin/unassigned" element={<AdminUnassigned />} />
            <Route path="/admin/escalated" element={<AdminEscalated />} />
            <Route path="/admin/staff" element={<AdminStaff />} />
            <Route path="/admin/departments" element={<AdminDepartments />} />
            <Route path="/admin/categories" element={<AdminCategories />} />
            <Route path="/admin/locations" element={<AdminLocations />} />
            <Route path="/admin/pending-locations" element={<AdminPendingLocations />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/audit-log" element={<AdminAuditLog />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
