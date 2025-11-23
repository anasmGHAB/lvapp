import "./globals.css";
import Sidebar from "./components/Sidebar";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nexus Analytics",
  description: "Premium web analytics dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-screen bg-slate-950 text-white font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
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
      </body>
    </html>
  );
}
