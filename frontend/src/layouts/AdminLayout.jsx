import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '../components/Sidebar';

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
