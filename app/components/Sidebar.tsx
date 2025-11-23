"use client";
import { HomeIcon, ChartBarIcon, Cog8ToothIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function Sidebar() {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "analytics";

  return (
    <aside className="w-72 h-screen fixed left-0 top-0 flex flex-col border-r border-white/10 bg-slate-900/50 backdrop-blur-xl z-50">
      {/* Logo Area */}
      <div className="p-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <span className="text-white font-bold text-xl">LV</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">LV App</h1>
          <p className="text-xs text-slate-400 font-medium tracking-wide">ANALYTICS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
        <NavItem
          href="/?view=analytics"
          icon={<ChartBarIcon className="w-5 h-5" />}
          label="Analytics"
          active={currentView === "analytics"}
        />
        <NavItem
          href="/?view=tagging-plan"
          icon={<DocumentTextIcon className="w-5 h-5" />}
          label="Tagging Plan"
          active={currentView === "tagging-plan"}
        />

        <div className="my-4 h-px bg-white/5 mx-4" />

        <NavItem
          href="/?view=settings"
          icon={<Cog8ToothIcon className="w-5 h-5" />}
          label="Settings"
          active={currentView === "settings"}
        />
      </nav>

      {/* User Profile (Optional footer) */}
      <div className="p-6 border-t border-white/5">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer border border-white/5">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-xs border border-indigo-500/30">
            AM
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Anas M</p>
            <p className="text-xs text-slate-400">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active = false, href }: { icon: React.ReactNode; label: string; active?: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${active
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
          : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
    >
      <span className={`${active ? "text-white" : "text-slate-400 group-hover:text-white"}`}>{icon}</span>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
}
