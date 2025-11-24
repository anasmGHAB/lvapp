"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTheme } from "../components/ThemeProvider";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  UsersIcon,
  EyeIcon,
  ShoppingBagIcon,
  CreditCardIcon,
  PlusIcon,
  UserCircleIcon,
  BellIcon,
  SwatchIcon,
  TrashIcon,
  CheckCircleIcon,
  PhotoIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

// ---------------------------------------------
// Types
// ---------------------------------------------
type ExcelRow = Record<string, any>;

// ---------------------------------------------
// 1. Fonction lecture Excel
// ---------------------------------------------
async function loadExcel() {
  try {
    const response = await fetch("/data/plan_tagging_fictif.xlsx");
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[sheetName]);
    return sheet;
  } catch (error) {
    console.error("Error loading Excel:", error);
    return [];
  }
}

// ---------------------------------------------
// 2. Composant principal
// ---------------------------------------------
export default function Page() {
  const [data, setData] = useState<ExcelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [photos, setPhotos] = useState<Record<number, string>>({});
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "analytics";
  const { user } = useUser();

  // Check if user is admin
  const isAdmin = user?.emailAddresses?.[0]?.emailAddress === "anasmghabar@gmail.com";

  useEffect(() => {
    loadExcel().then((sheetData) => {
      setData(sheetData);
      setLoading(false);
    });
    // Load photos from server
    fetch('/api/tagging-plan/photos')
      .then(res => res.json())
      .then(loadedPhotos => {
        setPhotos(loadedPhotos);
      })
      .catch(err => console.error('Failed to load photos:', err));
  }, []);

  // Reset save status after 3 seconds
  useEffect(() => {
    if (saveStatus === "success" || saveStatus === "error") {
      const timer = setTimeout(() => setSaveStatus("idle"), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // ---------------------------------------------
  // 3. Calcul des Métriques & Charts
  // ---------------------------------------------
  const metrics = useMemo(() => {
    if (!data.length) return { total: 0, uniquePages: 0, uniqueEvents: 0, completion: 0 };

    const total = data.length;
    const pageKey = Object.keys(data[0]).find(k => k.toLowerCase().includes("page")) || "Page";
    const eventKey = Object.keys(data[0]).find(k => k.toLowerCase().includes("event")) || "Event";

    const uniquePages = new Set(data.map(r => r[pageKey])).size;
    const uniqueEvents = new Set(data.map(r => r[eventKey])).size;

    return { total, uniquePages, uniqueEvents, completion: 85 };
  }, [data]);

  const chartData = useMemo(() => {
    if (!data.length) return [];
    const key = Object.keys(data[0])[0];
    const counts: Record<string, number> = {};

    data.forEach(row => {
      const val = row[key] ? String(row[key]) : "Unknown";
      counts[val] = (counts[val] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerTerm = searchTerm.toLowerCase();
    return data.filter(row =>
      Object.values(row).some(val =>
        String(val).toLowerCase().includes(lowerTerm)
      )
    );
  }, [data, searchTerm]);

  const tableHeaders = data.length > 0 ? Object.keys(data[0]).filter(h => h !== 'PHOTO') : [];

  // ---------------------------------------------
  // 4. Actions (Edit, Add, Delete, Save, Export)
  // ---------------------------------------------
  const handleCellChange = (rowIndex: number, header: string, value: string) => {
    if (!isAdmin) return; // Only admin can edit
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [header]: value };
    setData(newData);
  };

  const handleAddRow = () => {
    if (!isAdmin) return; // Only admin can add
    if (tableHeaders.length === 0) return;
    const newRow: ExcelRow = {};
    tableHeaders.forEach(h => newRow[h] = "");
    setData([newRow, ...data]);
  };

  const handleDeleteRow = (index: number) => {
    if (!isAdmin) return; // Only admin can delete
    const newData = data.filter((_, i) => i !== index);
    setData(newData);
    // Remove photo from state and save to server
    setPhotos(prev => {
      const newPhotos = { ...prev };
      delete newPhotos[index];
      // Save to server
      fetch('/api/tagging-plan/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPhotos)
      }).catch(err => console.error('Failed to save photos:', err));
      return newPhotos;
    });
  };

  const handleSaveChanges = async () => {
    if (!isAdmin) return; // Only admin can save
    setIsSaving(true);
    try {
      // Save photos to server
      await fetch('/api/tagging-plan/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(photos)
      });

      // Save data to Excel
      const response = await fetch('/api/tagging-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSaveStatus("success");
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = (rowIndex: number, file: File) => {
    if (!isAdmin) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const photoData = reader.result as string;
      setPhotos(prev => {
        const newPhotos = { ...prev, [rowIndex]: photoData };
        // Save to server immediately
        fetch('/api/tagging-plan/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPhotos)
        }).catch(err => console.error('Failed to save photos:', err));
        return newPhotos;
      });
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoClick = (rowIndex: number) => {
    if (photos[rowIndex]) {
      setPopupImage(photos[rowIndex]);
    }
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tagging Plan");
    XLSX.writeFile(wb, "tagging_plan_export.xlsx");
  };

  return (
    <div className="ml-72 p-8 min-h-screen text-slate-200">

      {/* Header */}
      <header className="flex justify-between items-end mb-10 animate-fade-in">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Welcome back!</h1>
          <p className="text-slate-400">Here's what's happening with the data today.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-lg shadow-indigo-600/20 font-medium cursor-pointer"
          >
            <ArrowDownTrayIcon className="w-5 h-5" /> Export Report
          </button>
        </div>
      </header>

      {/* VIEW: ANALYTICS */}
      {currentView === "analytics" && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <MetricCard
              title="Total Rows"
              value={metrics.total}
              change="+5.2%"
              icon={<UsersIcon className="w-6 h-6 text-indigo-400" />}
              color="bg-indigo-500/10 border-indigo-500/20"
            />
            <MetricCard
              title="Unique Pages"
              value={metrics.uniquePages}
              change="+8.1%"
              icon={<EyeIcon className="w-6 h-6 text-cyan-400" />}
              color="bg-cyan-500/10 border-cyan-500/20"
            />
            <MetricCard
              title="Unique Events"
              value={metrics.uniqueEvents}
              change="-1.4%"
              icon={<ShoppingBagIcon className="w-6 h-6 text-pink-400" />}
              color="bg-pink-500/10 border-pink-500/20"
            />
            <MetricCard
              title="Completion"
              value={`${metrics.completion}%`}
              change="+12.5%"
              icon={<CreditCardIcon className="w-6 h-6 text-emerald-400" />}
              color="bg-emerald-500/10 border-emerald-500/20"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {/* Main Bar Chart */}
            <div className="lg:col-span-2 glass-card p-6 min-h-[400px]">
              <h3 className="text-xl font-bold text-white mb-6">Tag Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                    interval={0}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#f8fafc' }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Side Pie/Info Chart */}
            <div className="glass-card p-6 min-h-[400px] flex flex-col">
              <h3 className="text-xl font-bold text-white mb-6">Status Overview</h3>
              <div className="flex-1 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Active', value: 65 },
                        { name: 'Pending', value: 25 },
                        { name: 'Deprecated', value: 10 },
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#6366f1" />
                      <Cell fill="#a855f7" />
                      <Cell fill="#334155" />
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">85%</p>
                    <p className="text-xs text-slate-400">Completion</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500"></span> Active</span>
                  <span className="font-bold">65%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Pending</span>
                  <span className="font-bold">25%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-700"></span> Deprecated</span>
                  <span className="font-bold">10%</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW: TAGGING PLAN */}
      {currentView === "tagging-plan" && (
        <div className="glass-card p-8 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div>
              <h3 className="text-2xl font-bold text-white">Tagging Plan</h3>
              <p className="text-slate-400 text-sm mt-1">Detailed view of all tracking events</p>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search tags, pages, events..."
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {isAdmin && (
                <>
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition shadow-lg font-medium whitespace-nowrap ${saveStatus === "success"
                      ? "bg-emerald-600 text-white"
                      : saveStatus === "error"
                        ? "bg-rose-600 text-white"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
                      }`}
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : saveStatus === "success" ? (
                      <CheckCircleIcon className="w-5 h-5" />
                    ) : (
                      <ArrowDownTrayIcon className="w-5 h-5" />
                    )}
                    {saveStatus === "success" ? "Saved!" : "Save Changes"}
                  </button>

                  <button
                    onClick={handleAddRow}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition shadow-lg shadow-slate-700/20 font-medium whitespace-nowrap"
                  >
                    <PlusIcon className="w-5 h-5" /> Add Row
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400 text-sm uppercase tracking-wider">
                    {tableHeaders.map((header) => (
                      <th key={header} className="px-6 py-4 font-medium">{header}</th>
                    ))}
                    <th className="px-6 py-4 font-medium w-32">PHOTO</th>
                    <th className="px-6 py-4 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {filteredData.slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition duration-150 group">
                      {tableHeaders.map((header) => (
                        <td key={`${idx}-${header}`} className="px-6 py-4 text-sm text-slate-300 group-hover:text-white whitespace-nowrap">
                          <input
                            type="text"
                            value={row[header] || ""}
                            onChange={(e) => handleCellChange(idx, header, e.target.value)}
                            readOnly={!isAdmin}
                            className={`bg-transparent border-none focus:ring-0 w-full text-slate-300 focus:text-white p-0 ${!isAdmin ? 'cursor-default' : ''}`}
                          />
                        </td>
                      ))}
                      <td className="px-6 py-4 text-center relative">
                        {/* Admin Controls */}
                        {isAdmin && (
                          <>
                            <input
                              ref={el => { fileInputRefs.current[idx] = el; }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePhotoUpload(idx, file);
                              }}
                            />
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  if (photos[idx]) {
                                    handlePhotoClick(idx);
                                  } else {
                                    fileInputRefs.current[idx]?.click();
                                  }
                                }}
                                className={`p-2 rounded-lg transition ${photos[idx]
                                  ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600/50'
                                  }`}
                                title={photos[idx] ? "View photo" : "Upload photo"}
                              >
                                <PhotoIcon className="w-5 h-5" />
                              </button>
                              {photos[idx] && (
                                <button
                                  onClick={() => {
                                    setPhotos(prev => {
                                      const newPhotos = { ...prev };
                                      delete newPhotos[idx];
                                      // Save to server immediately
                                      fetch('/api/tagging-plan/photos', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(newPhotos)
                                      }).catch(err => console.error('Failed to save photos:', err));
                                      return newPhotos;
                                    });
                                    // Reset file input to allow re-upload
                                    if (fileInputRefs.current[idx]) {
                                      fileInputRefs.current[idx]!.value = '';
                                    }
                                  }}
                                  className="p-2 rounded-lg transition bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                                  title="Delete photo"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </>
                        )}

                        {/* Non-Admin View */}
                        {!isAdmin && photos[idx] && (
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => handlePhotoClick(idx)}
                              className="p-2 rounded-lg transition bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30"
                              title="View photo"
                            >
                              <PhotoIcon className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteRow(idx)}
                            className="text-slate-500 hover:text-rose-500 transition p-1 rounded-lg hover:bg-rose-500/10"
                            title="Delete Row"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!loading && filteredData.length === 0 && (
              <div className="text-center py-20 text-slate-500">
                No results found for "{searchTerm}"
              </div>
            )}

            {!loading && filteredData.length > 50 && (
              <div className="text-center py-4 text-xs text-slate-500">
                Showing top 50 results of {filteredData.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Popup Modal */}
      {popupImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPopupImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4">
            <button
              onClick={() => setPopupImage(null)}
              className="absolute -top-2 -right-2 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full shadow-lg transition z-10"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
            <img
              src={popupImage}
              alt="Full size"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* VIEW: SETTINGS */}
      {currentView === "settings" && (
        <SettingsView />
      )}

    </div>
  );
}

// Settings View Component
function SettingsView() {
  const { user } = useUser();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-8">Settings</h2>

      <div className="grid gap-6">
        {/* Profile Section */}
        <div className="glass-card p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
              <UserCircleIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Profile Settings</h3>
              <p className="text-slate-400 text-sm">Manage your account information</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
              <input
                type="text"
                value={user?.fullName || user?.firstName || ""}
                readOnly
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email Address</label>
              <input
                type="email"
                value={user?.emailAddresses?.[0]?.emailAddress || ""}
                readOnly
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="glass-card p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <SwatchIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Appearance</h3>
              <p className="text-slate-400 text-sm">Customize the look and feel</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <div>
              <p className="text-white font-medium">Dark Mode</p>
              <p className="text-slate-400 text-xs">
                {theme === "dark" ? "Currently in dark mode" : "Currently in light mode"}
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${theme === "dark" ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${theme === "dark" ? 'right-1' : 'left-1'
                  }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, icon, color }: { title: string, value: string | number, change: string, icon: React.ReactNode, color: string }) {
  const isPositive = change.startsWith('+');
  return (
    <div className={`glass-card p-6 flex items-start justify-between relative overflow-hidden group`}>
      <div className="z-10 relative">
        <div className={`p-3 rounded-xl inline-block mb-4 ${color}`}>
          {icon}
        </div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        <p className={`text-xs font-bold mt-2 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {change} <span className="text-slate-500 font-normal ml-1">vs last month</span>
        </p>
      </div>
      {/* Decorative gradient blob */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition duration-500 ${isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
    </div>
  );
}
