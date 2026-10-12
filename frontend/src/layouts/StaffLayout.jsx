import { Outlet } from 'react-router-dom';
import { StaffSidebar } from '../components/Sidebar';

export default function StaffLayout() {
  return (
    <div className="flex min-h-screen">
      <StaffSidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
