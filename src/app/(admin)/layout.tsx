import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ToastContainer } from '@/components/ui/toast';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <ToastContainer />

      {/* Main content area */}
      <div className="lg:pl-64">
        <Header />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
