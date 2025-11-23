import "../globals.css";
import Sidebar from "../components/Sidebar";
import { Suspense } from "react";
import { UserButton } from "@clerk/nextjs";
import { ThemeProvider } from "../components/ThemeProvider";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div style={{ position: 'fixed', top: '15px', right: '15px', zIndex: 9999 }}>
        <UserButton />
      </div>
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 min-h-screen relative z-0">
        {/* Background Gradients for depth */}
        <div className="fixed inset-0 z-[-1] pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid.svg')] opacity-[0.03]"></div>
        </div>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </main>
    </ThemeProvider>
  );
}
