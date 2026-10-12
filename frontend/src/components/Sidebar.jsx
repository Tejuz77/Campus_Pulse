import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home, FileText, Bell, LogOut, User, Settings,
  LayoutDashboard, Users, MapPin, Tag, Building, ChevronRight,
  AlertTriangle, BarChart3, Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export function StudentSidebar() {
  const { user, logout, unreadCount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <aside className="w-64 min-h-screen glass border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm leading-none">CampusPulse</h1>
            <p className="text-xs text-slate-500 mt-0.5">SVECW</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.rollNo}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem to="/student" icon={Home} label="Dashboard" />
        <NavItem to="/student/report" icon={FileText} label="Report Issue" />
        <NavItem to="/student/tickets" icon={FileText} label="My Tickets" />
        <div className="relative">
          <NavItem to="/student/notifications" icon={Bell} label="Notifications" />
          {unreadCount > 0 && (
            <span className="absolute right-3 top-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/5">
        <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export function StaffSidebar() {
  const { user, logout, unreadCount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <aside className="w-64 min-h-screen glass border-r border-white/5 flex flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm leading-none">CampusPulse</h1>
            <p className="text-xs text-emerald-400 mt-0.5">Staff Portal</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300 text-xs font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.department?.name}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <NavItem to="/staff" icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/staff/tickets" icon={FileText} label="My Queue" />
        <div className="relative">
          <NavItem to="/staff/notifications" icon={Bell} label="Notifications" />
          {unreadCount > 0 && (
            <span className="absolute right-3 top-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-white/5">
        <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

export function AdminSidebar() {
  const { user, logout, unreadCount } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <aside className="w-64 min-h-screen glass border-r border-white/5 flex flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-slate-100 text-sm leading-none">CampusPulse</h1>
            <p className="text-xs text-purple-400 mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-300 text-xs font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <p className="text-xs text-purple-400 mt-0.5">Administrator</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <NavItem to="/admin" icon={LayoutDashboard} label="Overview" />
        <NavItem to="/admin/tickets" icon={FileText} label="All Tickets" />
        <NavItem to="/admin/unassigned" icon={AlertTriangle} label="Unassigned" />
        <NavItem to="/admin/escalated" icon={AlertTriangle} label="Escalated" />
        <NavItem to="/admin/staff" icon={Users} label="Staff Management" />
        <NavItem to="/admin/departments" icon={Building} label="Departments" />
        <NavItem to="/admin/categories" icon={Tag} label="Categories" />
        <NavItem to="/admin/locations" icon={MapPin} label="Locations" />
        <NavItem to="/admin/pending-locations" icon={MapPin} label="Pending Places" />
        <NavItem to="/admin/analytics" icon={BarChart3} label="Analytics" />
        <NavItem to="/admin/audit-log" icon={FileText} label="Audit Log" />
        <NavItem to="/admin/settings" icon={Settings} label="Settings" />
        <div className="relative">
          <NavItem to="/admin/notifications" icon={Bell} label="Notifications" />
          {unreadCount > 0 && (
            <span className="absolute right-3 top-2 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-white/5">
        <button onClick={handleLogout} className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
