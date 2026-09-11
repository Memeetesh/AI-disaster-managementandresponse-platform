import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/lib/toast-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate2-50">
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
    </ToastProvider>
  );
}
