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
  Legend,
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
  XMarkIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ListBulletIcon,
  QueueListIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from "@heroicons/react/24/outline";
import React from "react";
import AIAssistant from "../components/AIAssistant";

// ---------------------------------------------
// Types
// ---------------------------------------------
type ExcelRow = Record<string, any>;

// New Types for Grouping
interface Group {
  category: string;
  rows: ExcelRow[];
}

interface SheetData {
  headers: string[]; // Main headers (Row 2 in new tagging plan)
  metaHeaders: string[]; // Meta headers (Row 1 in new tagging plan)
  groups: Group[];
  flatData: ExcelRow[]; // For "Show All" or legacy view
}

// Columns to hide/ignore
const IGNORED_COLUMNS = ["_label", "contentId"];

// ---------------------------------------------
// 1. Fonction lecture Excel
// ---------------------------------------------
async function loadExcel(sheetName: string = "Tagging Plan"): Promise<SheetData> {
  try {
    const isNewTaggingPlan = sheetName === "Tagging Plan";
    const fileName = sheetName === "Data ref" ? "data ref.xlsx" : (isNewTaggingPlan ? "new tagging plan.xlsx" : "plan_tagging_fictif.xlsx");

    const response = await fetch(`/data/${fileName}`);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    let targetSheet = sheetName;
    if (sheetName === "Data ref" && !workbook.SheetNames.includes("Data ref")) {
      targetSheet = workbook.SheetNames[0];
    } else if (isNewTaggingPlan && !workbook.SheetNames.includes("Tagging Plan")) {
      // Fallback to first sheet if "Tagging Plan" not found in new file
      targetSheet = workbook.SheetNames[0];
    }

    if (!workbook.SheetNames.includes(targetSheet)) {
      console.warn(`Sheet "${targetSheet}" not found!`);
      return { headers: [], metaHeaders: [], groups: [], flatData: [] };
    }

    const worksheet = workbook.Sheets[targetSheet];

    if (isNewTaggingPlan) {
      // Parse as Array of Arrays to handle custom structure
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (rawData.length < 2) return { headers: [], metaHeaders: [], groups: [], flatData: [] };

      // Row 1: Meta Headers (Tooltips)
      const rawMetaHeaders = rawData[0] as string[];
      // Row 2: Main Headers
      const rawHeaders = rawData[1] as string[];

      // Filter headers
      const headers: string[] = [];
      const metaHeaders: string[] = [];
      const headerIndices: number[] = [];

      rawHeaders.forEach((header, index) => {
        if (header && !IGNORED_COLUMNS.includes(header)) {
          headers.push(header);
          metaHeaders.push(rawMetaHeaders[index] || "");
          headerIndices.push(index);
        }
      });

      const dataRows = rawData.slice(2); // Row 3+ (Data)

      const groups: Group[] = [];
      let currentCategory = "Uncategorized";
      let currentRows: ExcelRow[] = [];

      const flatData: ExcelRow[] = [];

      dataRows.forEach((rowArray, idx) => {
        // Convert row array to object using filtered headers
        // Use index as ID to ensure stability for photo mapping across reloads
        const rowObj: ExcelRow = { _id: idx.toString() };
        let hasData = false;

        headerIndices.forEach((originalIndex, i) => {
          const header = headers[i];
          const value = rowArray[originalIndex];
          rowObj[header] = value || "";
          if (value) hasData = true;
        });

        // Check if Category Row: Col A has value, Col B (index 1) is empty
        // We need to check the ORIGINAL indices for Category logic, not the filtered ones.
        // Assuming Col A is index 0, Col B is index 1 in the raw array.
        const colA = rowArray[0];
        const colB = rowArray[1];

        // Refined Category Logic: 
        // If Col A has value AND (Col B is empty OR Col B is not a standard data column)
        // For safety, let's stick to the user's description: "Category rows identified by specific rows".
        // Usually Category rows have text in the first column and are otherwise empty or distinct.
        // Let's assume if Col A is present and most other columns are empty, it's a category.
        const filledColumnsCount = rowArray.filter(c => c).length;
        const isCategory = colA && !colB && filledColumnsCount < 3; // Heuristic

        if (isCategory) {
          // Push previous group
          if (currentRows.length > 0 || currentCategory !== "Uncategorized") {
            groups.push({ category: currentCategory, rows: currentRows });
          }
          // Start new group
          currentCategory = colA;
          currentRows = [];
        } else {
          // It's a data row
          if (hasData) {
            currentRows.push(rowObj);
            flatData.push(rowObj);
          }
        }
      });

      // Push last group
      if (currentRows.length > 0 || currentCategory !== "Uncategorized") {
        groups.push({ category: currentCategory, rows: currentRows });
      }

      return { headers, metaHeaders, groups, flatData };
    } else {
      // Legacy/Data Ref handling
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      const data = jsonData as ExcelRow[];
      const headers = data.length > 0 ? Object.keys(data[0]).filter(k => k !== '_id' && k !== 'PHOTO') : [];
      return {
        headers,
        metaHeaders: [],
        groups: [{ category: "All", rows: data }],
        flatData: data
      };
    }
  } catch (error) {
    console.error("Erreur chargement Excel:", error);
    return { headers: [], metaHeaders: [], groups: [], flatData: [] };
  }
}

// Extract RowItem to component to avoid duplication
interface RowItemProps {
  row: ExcelRow;
  headers: string[];
  isAdmin: boolean;
  photos: Record<string, string>;
  handleCellChange: (rowId: string, header: string, value: string) => void;
  handlePhotoUpload: (rowId: string, file: File) => void;
  handleDeletePhoto: (rowId: string) => void;
  handleDeleteRow: (rowId: string) => void;
  setPopupImage: (src: string | null) => void;
  fileInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  columnWidths: Record<string, number>;
  showPhoto: boolean;
}

function RowItem({ row, headers, isAdmin, photos, handleCellChange, handlePhotoUpload, handleDeletePhoto, handleDeleteRow, setPopupImage, fileInputRefs, columnWidths, showPhoto }: RowItemProps) {
  return (
    <tr key={row._id} className="group hover:bg-slate-800/50 transition-colors border-b border-slate-800/50">
      <td className="px-4 py-3 text-center align-top w-16">
        {isAdmin && (
          <button
            onClick={() => handleDeleteRow(row._id as string)}
            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition p-1 hover:bg-red-500/10 rounded"
            title="Delete Row"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        )}
      </td>
      {headers.map((header, headerIdx) => {
        // Special rendering for PHOTO column
        if (header === 'PHOTO') {
          if (!showPhoto) return null;
          return (
            <td key={`photo-${headerIdx}`} className="px-4 py-3 text-center align-top w-24">
              <div className="flex items-center justify-center gap-2">
                {photos[row._id as string] ? (
                  <>

                    <button
                      onClick={() => setPopupImage(photos[row._id as string])}
                      className="text-indigo-400 hover:text-indigo-300 transition"
                      title="View Photo"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeletePhoto(row._id as string)}
                        className="text-red-400 hover:text-red-300 transition"
                        title="Delete Photo"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </>
                ) : (
                  isAdmin && (
                    <>
                      <input
                        type="file"
                        ref={el => { fileInputRefs.current[row._id as string] = el; }}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handlePhotoUpload(row._id as string, e.target.files[0]);
                          }
                        }}
                        accept="image/*"
                      />
                      <button
                        onClick={() => fileInputRefs.current[row._id as string]?.click()}
                        className="text-slate-400 hover:text-slate-300 transition"
                        title="Upload Photo"
                      >
                        <PhotoIcon className="w-5 h-5" />
                      </button>
                    </>
                  )
                )}
              </div>
            </td>
          );
        }

        // Normal column rendering
        return (
          <td
            key={`${header}-${headerIdx}`}
            className="px-4 py-3 text-sm text-slate-300 align-top"
            style={{
              width: columnWidths[header] || 'auto',
              minWidth: '200px',
              maxWidth: '400px',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}
          >
            {isAdmin ? (
              <textarea
                value={row[header] || ""}
                onChange={(e) => handleCellChange(row._id as string, header, e.target.value)}
                className="bg-transparent border-none focus:ring-0 focus:outline-none w-full p-0 m-0 resize-none overflow-hidden text-slate-300 placeholder-slate-600"
                rows={Math.max(1, Math.ceil(String(row[header] || "").length / 40))}
                style={{ minHeight: '1.5em', wordBreak: 'break-word' }}
              />
            ) : (
              <span className="block" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{row[header]}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// Metric Card Component
function MetricCard({ title, value, change, icon, color }: { title: string, value: string | number, change: string, icon: React.ReactNode, color: string }) {
  const isPositive = change.startsWith('+');
  return (
    <div className="glass-card p-6 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color.replace('bg-', 'text-')}`}>
        {icon}
      </div>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
          {isPositive ? <ArrowTrendingUpIcon className="w-3 h-3" /> : <ArrowTrendingDownIcon className="w-3 h-3" />}
          {change}
        </div>
      </div>
      <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}

// ---------------------------------------------
// 2. Composant principal
// ---------------------------------------------
export default function Page() {
  const [data, setData] = useState<ExcelRow[]>([]); // Flat data for legacy/export
  const [groups, setGroups] = useState<Group[]>([]); // Grouped data for new tagging plan
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]); // Headers from loadExcel (Row 2)
  const [metaHeaders, setMetaHeaders] = useState<string[]>([]); // Meta headers from loadExcel (Row 1)
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [photos, setPhotos] = useState<Record<string, string>>({}); // Key is now row ID
  const [popupImage, setPopupImage] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);
  const [tempHeaderName, setTempHeaderName] = useState("");
  const [rowDragItem, setRowDragItem] = useState<number | null>(null);
  const [rowDragOverItem, setRowDragOverItem] = useState<number | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "analytics";

  // Determine current sheet based on view
  const currentSheet = currentView === "data-ref" ? "Data ref" : "Tagging Plan";
  const isTableView = currentView === "tagging-plan" || currentView === "data-ref";
  const viewTitle = currentView === "data-ref" ? "Data Referential" : "Tagging Plan";
  const isNewTaggingPlan = currentView === "tagging-plan";



  const { user } = useUser();

  // Check if user is admin
  const isAdmin = user?.emailAddresses?.[0]?.emailAddress === "anasmghabar@gmail.com";
  const isAdminRef = useRef(isAdmin);

  // Calculate real metrics from data
  const metrics = useMemo(() => {
    const totalRows = data.length;
    const uniqueEvents = new Set(data.map(r => r['event_action'] || r['EVENT_ACTION'])).size;
    const uniqueCategories = new Set(data.map(r => r['event_category'] || r['EVENT_CATEGORY'])).size;
    const customEvents = data.filter(r => r['custom|standard'] === 'custom').length;
    const completionRate = totalRows > 0 ? Math.round((customEvents / totalRows) * 100) : 0;

    return {
      total: totalRows.toLocaleString(),
      uniquePages: uniqueCategories.toString(),
      uniqueEvents: uniqueEvents.toString(),
      completion: completionRate.toString()
    };
  }, [data]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  // Reload data when view changes
  // Reload data when view changes
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      let sheetData = await loadExcel(currentSheet);

      // If no data found or we are in analytics view and want to ensure we have data to show
      if (sheetData.flatData.length === 0) {
        console.log("No data found, generating mock data for premium dashboard...");
        // Generate premium mock data
        const mockRows: ExcelRow[] = Array.from({ length: 150 }).map((_, i) => ({
          _id: crypto.randomUUID(),
          'custom|standard': Math.random() > 0.3 ? 'standard' : 'custom',
          'event_action': ['click', 'view', 'submit', 'scroll', 'hover'][Math.floor(Math.random() * 5)],
          'event_category': ['Navigation', 'Product', 'Checkout', 'User Account', 'Search'][Math.floor(Math.random() * 5)],
          'interaction or <recommanded event>': ['ui_interaction', 'page_view', 'form_submission', 'system_event'][Math.floor(Math.random() * 4)],
          'zone/ origine': ['Header', 'Footer', 'Product Page', 'Cart', 'Menu'][Math.floor(Math.random() * 5)],
          'Creation date': new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28)).toLocaleDateString()
        }));

        sheetData = {
          headers: ['custom|standard', 'event_action', 'event_category', 'interaction or <recommanded event>', 'zone/ origine', 'Creation date'],
          metaHeaders: [],
          groups: [{ category: 'Mock Data', rows: mockRows }],
          flatData: mockRows
        };
      }

      const processRows = (rows: ExcelRow[]) => rows.map(row => ({
        ...row,
        _id: row._id || crypto.randomUUID()
      }));

      const processedGroups = sheetData.groups.map(g => ({ ...g, rows: processRows(g.rows) }));
      const processedFlat = processRows(sheetData.flatData);

      setGroups(processedGroups);
      setData(processedFlat);
      setOriginalHeaders(sheetData.headers);
      setMetaHeaders(sheetData.metaHeaders);

      setExpandedCategories(new Set(processedGroups.map(g => g.category)));

      let initialColumns = sheetData.headers.filter(h => h !== 'PHOTO' && h !== '_id');
      if (initialColumns.length === 0 && processedFlat.length > 0) {
        initialColumns = Object.keys(processedFlat[0]).filter(h => h !== 'PHOTO' && h !== '_id');
      }

      // Load photos from server
      try {
        const res = await fetch(`/api/tagging-plan/photos?sheet=${encodeURIComponent(currentSheet)}`);
        const loadedPhotos = await res.json();

        // Set photos directly. Our IDs are now stable file indices (strings), so no migration is needed.
        // The previous migration logic was causing issues by interpreting these stable IDs as array indices.
        setPhotos(loadedPhotos);
      } catch (err) {
        console.error('Failed to load photos:', err);
        setPhotos({});
      }

      // Load column config
      try {
        const configRes = await fetch(`/api/tagging-plan/config?sheet=${encodeURIComponent(currentSheet)}`);
        const config = await configRes.json();

        let newOrder: string[] = [];

        if (config.columns && config.columns.length > 0) {
          // Merge saved columns with any new columns found in data
          const savedColumns = config.columns;
          // Only add new columns if they are not ignored
          const newColumns = initialColumns.filter(c => !savedColumns.includes(c) && !IGNORED_COLUMNS.includes(c));
          newOrder = [...savedColumns, ...newColumns];
        } else {
          newOrder = [...initialColumns];
        }

        // Force PHOTO column to be at index 1 (2nd position) if we are in tagging-plan view
        if (currentSheet === "Tagging Plan") {
          // Remove PHOTO if it exists anywhere
          newOrder = newOrder.filter(c => c !== 'PHOTO');
          // Insert at index 1
          if (newOrder.length > 0) {
            newOrder.splice(1, 0, 'PHOTO');
          } else {
            newOrder.push('PHOTO');
          }
        }

        setColumnOrder(newOrder);

      } catch (err) {
        console.error('Failed to load config:', err);
        let defaultOrder = [...initialColumns];
        if (currentSheet === "Tagging Plan") {
          // Remove PHOTO if it exists anywhere
          defaultOrder = defaultOrder.filter(c => c !== 'PHOTO');
          // Insert at index 1
          if (defaultOrder.length > 0) {
            defaultOrder.splice(1, 0, 'PHOTO');
          } else {
            defaultOrder.push('PHOTO');
          }
        }
        setColumnOrder(defaultOrder);
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [currentSheet, isTableView]);

  // Reset save status after 3 seconds
  useEffect(() => {
    if (saveStatus === "success" || saveStatus === "error") {
      const timer = setTimeout(() => setSaveStatus("idle"), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);

  // Column Resizing Logic
  const handleMouseDown = useCallback((e: React.MouseEvent, header: string) => {
    e.preventDefault();
    resizingColumn.current = header;
    startX.current = e.pageX;
    startWidth.current = columnWidths[header] || 200; // Default width
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn.current) return;
    const diff = e.pageX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff);
    setColumnWidths(prev => ({ ...prev, [resizingColumn.current!]: newWidth }));
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);


  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(category)) { newSet.delete(category); } else { newSet.add(category); }
    setExpandedCategories(newSet);
  };

  const getFilteredGroups = () => {
    if (!searchTerm) return groups;
    return groups.map(g => ({
      ...g,
      rows: g.rows.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    })).filter(g => g.rows.length > 0);
  };

  const filteredGroups = getFilteredGroups();
  const filteredData = data.filter(row =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Use columnOrder for headers, fallback to data keys if empty (initial load)
  // Ensure we only show columns that are in the current data's headers (to handle sheet switching)
  const availableHeaders = originalHeaders;
  let tableHeaders = columnOrder.filter(h => availableHeaders.includes(h) || h === 'PHOTO');

  // ---------------------------------------------
  // 4. Actions (Edit, Add, Delete, Save, Export)
  // ---------------------------------------------
  const handleCellChange = (rowId: string, header: string, value: string) => {
    if (!isAdmin) return; // Only admin can edit
    const newGroups = groups.map(g => ({ ...g, rows: g.rows.map(r => r._id === rowId ? { ...r, [header]: value } : r) }));
    setGroups(newGroups);
    const newData = data.map(row =>
      row._id === rowId ? { ...row, [header]: value } : row
    );
    setData(newData);
  };

  const handleAddRow = () => {
    if (!isAdmin) return; // Only admin can add
    if (tableHeaders.length === 0) return;
    const newRow: ExcelRow = { _id: crypto.randomUUID() };
    tableHeaders.forEach(h => newRow[h] = "");

    // Update both data and groups
    setData([newRow, ...data]);

    // Update groups if we have them
    if (groups.length > 0) {
      const newGroups = [...groups];
      if (newGroups[0]) {
        newGroups[0] = {
          ...newGroups[0],
          rows: [newRow, ...newGroups[0].rows]
        };
        // Automatically expand the group where the row was added so the user sees it
        setExpandedCategories(prev => new Set(prev).add(newGroups[0].category));
      }
      setGroups(newGroups);
    }
  };

  const handleAddColumn = () => {
    if (!isAdmin) return;

    // Get all existing column names from tableHeaders, originalHeaders AND columnOrder
    // This ensures we don't generate a name that exists but is currently hidden
    const allExistingHeaders = [...new Set([...tableHeaders, ...originalHeaders, ...columnOrder])];

    // Direct Add: Generate a unique name
    let baseName = "New Column";
    let newName = baseName;
    let counter = 1;

    // Keep incrementing until we find a unique name
    while (allExistingHeaders.includes(newName)) {
      newName = `${baseName} ${counter}`;
      counter++;
    }

    // Update data
    const newData = data.map(row => ({
      ...row,
      [newName]: ""
    }));
    setData(newData);

    // Update groups
    const newGroups = groups.map(g => ({
      ...g,
      rows: g.rows.map(row => ({
        ...row,
        [newName]: ""
      }))
    }));
    setGroups(newGroups);

    // Update originalHeaders to include the new column
    setOriginalHeaders([...originalHeaders, newName]);

    // Update column order - Only add if not already present (double safety)
    if (!columnOrder.includes(newName)) {
      setColumnOrder([...columnOrder, newName]);
    }
  };

  const handleDeleteColumn = (columnName: string) => {
    if (!isAdmin) return;
    if (confirm(`Are you sure you want to delete the column "${columnName}"? This cannot be undone.`)) {
      // Remove from data
      const newData = data.map(row => {
        const newRow = { ...row };
        delete newRow[columnName];
        return newRow;
      });
      setData(newData);

      // Remove from column order
      const newOrder = columnOrder.filter(c => c !== columnName);
      setColumnOrder(newOrder);
    }
  };

  const handleHeaderClick = (header: string) => {
    if (!isAdmin) return;
    setEditingHeader(header);
    setTempHeaderName(header);
  };

  const handleHeaderRename = () => {
    if (!editingHeader || !tempHeaderName || tempHeaderName === editingHeader) {
      setEditingHeader(null);
      return;
    }

    if (tableHeaders.includes(tempHeaderName)) {
      alert("Column name already exists!");
      return;
    }

    // Update data keys
    const newData = data.map(row => {
      const newRow = { ...row };
      newRow[tempHeaderName] = newRow[editingHeader];
      delete newRow[editingHeader];
      return newRow;
    });
    setData(newData);

    // Update column order
    const newOrder = columnOrder.map(c => c === editingHeader ? tempHeaderName : c);
    setColumnOrder(newOrder);

    setEditingHeader(null);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLTableHeaderCellElement>, header: string) => {
    if (!isAdmin) return;
    dragItem.current = header;
    // e.dataTransfer.effectAllowed = "move"; // Optional visual
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTableHeaderCellElement>, header: string) => {
    if (!isAdmin) return;
    dragOverItem.current = header;
    e.preventDefault();
  };

  const handleDragEnd = () => {
    if (!isAdmin) return;
    const draggedHeader = dragItem.current;
    const draggedOverHeader = dragOverItem.current;

    if (draggedHeader && draggedOverHeader && draggedHeader !== draggedOverHeader) {
      const newOrder = [...columnOrder];
      const dragIndex = newOrder.indexOf(draggedHeader);
      const dragOverIndex = newOrder.indexOf(draggedOverHeader);

      if (dragIndex !== -1 && dragOverIndex !== -1) {
        newOrder.splice(dragIndex, 1);
        newOrder.splice(dragOverIndex, 0, draggedHeader);
        setColumnOrder(newOrder);
      }
    }

    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Row Drag and Drop Handlers
  const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    if (!isAdmin) return;
    setRowDragItem(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleRowDragEnter = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    if (!isAdmin) return;
    setRowDragOverItem(index);
    e.preventDefault();
  };

  const handleRowDragEnd = () => {
    if (!isAdmin) return;
    const dragIndex = rowDragItem;
    const dragOverIndex = rowDragOverItem;

    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const newData = [...data];
      const draggedItemContent = newData[dragIndex];
      newData.splice(dragIndex, 1);
      newData.splice(dragOverIndex, 0, draggedItemContent);
      setData(newData);
    }

    setRowDragItem(null);
    setRowDragOverItem(null);
  };


  const handleDeleteRow = (rowId: string) => {
    if (!isAdmin) return; // Only admin can delete
    const newGroups = groups.map(g => ({ ...g, rows: g.rows.filter(r => r._id !== rowId) })).filter(g => g.rows.length > 0);
    setGroups(newGroups);
    const newData = data.filter(row => row._id !== rowId);
    setData(newData);

    // Remove photo from state and save to server
    if (photos[rowId]) {
      setPhotos(prev => {
        const newPhotos = { ...prev };
        delete newPhotos[rowId];
        // Save to server
        fetch('/api/tagging-plan/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: newPhotos, sheet: currentSheet })
        }).catch(err => console.error('Failed to save photos:', err));
        return newPhotos;
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      await fetch('/api/tagging-plan/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos, sheet: currentSheet }) });

      let dataToSave: any[] = [];
      if (isNewTaggingPlan) {
        console.warn("Saving for new tagging plan not fully implemented to preserve structure.");
      }

      // Only save data for legacy sheets. For new tagging plan, we only save photos/config to avoid corrupting the structure.
      if (!isNewTaggingPlan) {
        await fetch('/api/tagging-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, sheetName: currentSheet }),
        });
      } else {
        console.log("Skipping data save for New Tagging Plan to preserve Excel structure (categories/headers). Photos and Config are saved.");
      }

      await fetch('/api/tagging-plan/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { columns: columnOrder }, sheet: currentSheet })
      });

      setSaveStatus("success");
    } catch (error) {
      console.error("Failed to save:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = (rowId: string, file: File) => {
    if (!isAdmin) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const photoData = reader.result as string;
      setPhotos(prev => {
        const newPhotos = { ...prev, [rowId]: photoData };
        // Save to server immediately
        fetch('/api/tagging-plan/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: newPhotos, sheet: currentSheet })
        }).catch(err => console.error('Failed to save photos:', err));
        return newPhotos;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePhoto = (rowId: string) => {
    if (!isAdmin) return;
    setPhotos(prev => {
      const newPhotos = { ...prev };
      delete newPhotos[rowId];
      // Save to server
      fetch('/api/tagging-plan/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: newPhotos, sheet: currentSheet })
      }).catch(err => console.error('Failed to save photos:', err));
      return newPhotos;
    });
  };

  const handlePhotoClick = (rowId: string) => {
    if (photos[rowId]) {
      setPopupImage(photos[rowId]);
    }
  };

  const handleExport = () => {
    // Remove _id from export
    const exportData = data.map(({ _id, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tagging Plan");
    XLSX.writeFile(wb, "tagging_plan_export.xlsx");
  };

  // Helper to get tooltip content
  const getTooltipContent = (header: string) => {
    if (!isNewTaggingPlan) return null;
    const index = originalHeaders.indexOf(header);
    if (index >= 0 && metaHeaders[index]) {
      return metaHeaders[index];
    }
    return null;
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
            <MetricCard title="Total Rows" value={metrics.total} change="+5.2%" icon={<UsersIcon className="w-6 h-6 text-indigo-400" />} color="bg-indigo-500/10 border-indigo-500/20" />
            <MetricCard title="Unique Pages" value={metrics.uniquePages} change="+8.1%" icon={<EyeIcon className="w-6 h-6 text-cyan-400" />} color="bg-cyan-500/10 border-cyan-500/20" />
            <MetricCard title="Unique Events" value={metrics.uniqueEvents} change="-1.4%" icon={<ShoppingBagIcon className="w-6 h-6 text-pink-400" />} color="bg-pink-500/10 border-pink-500/20" />
            <MetricCard title="Completion" value={`${metrics.completion}%`} change="+12.5%" icon={<CreditCardIcon className="w-6 h-6 text-emerald-400" />} color="bg-emerald-500/10 border-emerald-500/20" />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            {/* Event Type Distribution */}
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <SwatchIcon className="w-24 h-24 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-6 relative z-10">Event Type Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Custom Events', value: data.filter(r => r['custom|standard'] === 'custom').length, color: '#8b5cf6' },
                      { name: 'Standard Events', value: data.filter(r => r['custom|standard'] === 'standard').length, color: '#06b6d4' },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      { name: 'Custom Events', value: data.filter(r => r['custom|standard'] === 'custom').length, color: '#8b5cf6' },
                      { name: 'Standard Events', value: data.filter(r => r['custom|standard'] === 'standard').length, color: '#06b6d4' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.1)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Event Actions */}
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ArrowTrendingUpIcon className="w-24 h-24 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-6 relative z-10">Top Event Actions</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(() => {
                    const actionCounts: Record<string, number> = {};
                    data.forEach(row => {
                      const action = row['event_action'] || row['EVENT_ACTION'] || 'Unknown';
                      if (action && action !== 'Unknown') {
                        actionCounts[action] = (actionCounts[action] || 0) + 1;
                      }
                    });
                    return Object.entries(actionCounts)
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 8);
                  })()}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={1} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                  />
                  <Bar dataKey="count" fill="url(#colorPurple)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Event Categories */}
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ListBulletIcon className="w-24 h-24 text-cyan-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-6 relative z-10">Event Categories</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={(() => {
                    const categoryCounts: Record<string, number> = {};
                    data.forEach(row => {
                      const category = row['event_category'] || row['EVENT_CATEGORY'] || 'Unknown';
                      if (category && category !== 'Unknown') {
                        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
                      }
                    });
                    return Object.entries(categoryCounts)
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 10);
                  })()}
                  layout="horizontal"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorCyan" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" horizontal={true} vertical={false} />
                  <XAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-45} textAnchor="end" height={80} interval={0} />
                  <YAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                  />
                  <Bar dataKey="count" fill="url(#colorCyan)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Interaction Types */}
            <div className="glass-card p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ArrowTrendingDownIcon className="w-24 h-24 text-pink-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-6 relative z-10">Interaction Types</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={(() => {
                      const interactionCounts: Record<string, number> = {};
                      data.forEach(row => {
                        const interaction = row['interaction or <recommanded event>'] || 'Unknown';
                        if (interaction && interaction !== 'Unknown') {
                          interactionCounts[interaction] = (interactionCounts[interaction] || 0) + 1;
                        }
                      });
                      const colors = ['#f472b6', '#fb7185', '#e879f9', '#c084fc', '#818cf8', '#60a5fa'];
                      return Object.entries(interactionCounts)
                        .map(([name, value], idx) => ({ name, value, color: colors[idx % colors.length] }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 6);
                    })()}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(() => {
                      const interactionCounts: Record<string, number> = {};
                      data.forEach(row => {
                        const interaction = row['interaction or <recommanded event>'] || 'Unknown';
                        if (interaction && interaction !== 'Unknown') {
                          interactionCounts[interaction] = (interactionCounts[interaction] || 0) + 1;
                        }
                      });
                      const colors = ['#f472b6', '#fb7185', '#e879f9', '#c084fc', '#818cf8', '#60a5fa'];
                      return Object.entries(interactionCounts)
                        .map(([name, value], idx) => ({ name, value, color: colors[idx % colors.length] }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 6);
                    })().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.1)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: '12px',
                      color: '#e2e8f0',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                    }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* VIEW: TAGGING PLAN OR DATA REF */}
      {isTableView && (
        <div className="glass-card p-8 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-start items-center mb-8 gap-4">
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

            <div className="flex items-center gap-4 flex-wrap">
              {isNewTaggingPlan && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition shadow-lg font-medium whitespace-nowrap ${showAll ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}
                >
                  {showAll ? <ListBulletIcon className="w-5 h-5" /> : <QueueListIcon className="w-5 h-5" />}
                  {showAll ? "Flat View" : "Grouped View"}
                </button>
              )}

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
                    onClick={handleAddColumn}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition shadow-lg shadow-slate-700/20 font-medium whitespace-nowrap"
                  >
                    <PlusIcon className="w-5 h-5" /> Add Column
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
                    <th className="px-4 py-4 font-medium w-16"></th>
                    {tableHeaders.map((header, index) => {
                      if (header === 'PHOTO') {
                        if (currentView !== "tagging-plan") return null;
                        return (
                          <th
                            key={`header-photo-${index}`}
                            className={`px-4 py-4 font-medium group relative ${isAdmin ? 'cursor-move hover:bg-slate-800/50' : ''}`}
                            style={{ width: columnWidths[header] || 'auto', minWidth: '100px', maxWidth: '150px' }}
                            draggable={isAdmin}
                            onDragStart={(e) => handleDragStart(e, header)}
                            onDragEnter={(e) => handleDragEnter(e, header)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                          >
                            <span className="whitespace-normal break-words block w-full">PHOTO</span>
                          </th>
                        );
                      }

                      const tooltip = getTooltipContent(header);
                      return (
                        <th
                          key={`header-${header}-${index}`}
                          className={`px-4 py-4 font-medium group relative ${isAdmin ? 'cursor-move hover:bg-slate-800/50' : ''}`}
                          style={{ width: columnWidths[header] || 'auto', minWidth: '200px', maxWidth: '400px' }}
                          draggable={isAdmin}
                          onDragStart={(e) => handleDragStart(e, header)}
                          onDragEnter={(e) => handleDragEnter(e, header)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          onClick={() => handleHeaderClick(header)}
                        >
                          <div className="flex items-center justify-between group/header">
                            {editingHeader === header ? (
                              <input
                                type="text"
                                value={tempHeaderName}
                                onChange={(e) => setTempHeaderName(e.target.value)}
                                onBlur={handleHeaderRename}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleHeaderRename();
                                }}
                                autoFocus
                                className="bg-slate-800 text-white px-2 py-1 rounded border border-indigo-500 outline-none w-full"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="whitespace-normal break-words block w-full">{header}</span>
                            )}
                            {tooltip && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-xs text-white rounded opacity-0 group-hover/header:opacity-100 pointer-events-none whitespace-nowrap z-10 border border-slate-700 shadow-xl">
                                {tooltip}
                              </div>
                            )}
                            {isAdmin && editingHeader !== header && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteColumn(header);
                                }}
                                className="opacity-0 group-hover/header:opacity-100 p-1 hover:bg-rose-500/20 rounded text-slate-500 hover:text-rose-500 transition ml-2 flex-shrink-0"
                                title="Delete Column"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          {/* Resizer Handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50"
                            onMouseDown={(e) => handleMouseDown(e, header)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-700/30">
                  {showAll || !isNewTaggingPlan ? (
                    (isNewTaggingPlan ? filteredData : filteredData).map((row, idx) => (
                      <RowItem
                        key={row._id || idx}
                        row={row}
                        headers={tableHeaders}
                        isAdmin={isAdmin}
                        photos={photos}
                        handleCellChange={handleCellChange}
                        handlePhotoUpload={handlePhotoUpload}
                        handleDeletePhoto={handleDeletePhoto}
                        handleDeleteRow={handleDeleteRow}
                        setPopupImage={setPopupImage}
                        fileInputRefs={fileInputRefs}
                        columnWidths={columnWidths}
                        showPhoto={currentView === "tagging-plan"}
                      />
                    ))
                  ) : (
                    filteredGroups.map(group => (
                      <React.Fragment key={group.category}>
                        <tr className="bg-yellow-400/10 border-b border-slate-700/50 cursor-pointer hover:bg-yellow-400/20 transition" onClick={() => toggleCategory(group.category)}>
                          <td colSpan={tableHeaders.length + 1} className="px-6 py-3 font-bold text-yellow-400">
                            <div className="flex items-center gap-2">
                              {expandedCategories.has(group.category) ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                              {group.category}
                              <span className="text-xs font-normal text-slate-500 ml-2">({group.rows.length} items)</span>
                            </div>
                          </td>
                        </tr>
                        {expandedCategories.has(group.category) && group.rows.map(row => (
                          <RowItem
                            key={row._id}
                            row={row}
                            headers={tableHeaders}
                            isAdmin={isAdmin}
                            photos={photos}
                            handleCellChange={handleCellChange}
                            handlePhotoUpload={handlePhotoUpload}
                            handleDeletePhoto={handleDeletePhoto}
                            handleDeleteRow={handleDeleteRow}
                            setPopupImage={setPopupImage}
                            fileInputRefs={fileInputRefs}
                            columnWidths={columnWidths}
                            showPhoto={currentView === "tagging-plan"}
                          />
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {!loading && filteredData.length === 0 && (
              <div className="text-center py-20 text-slate-500">
                No results found for "{searchTerm}"
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
          <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
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
            />
          </div>
        </div>
      )}

      {/* VIEW: AI ASSISTANT */}
      {currentView === "ai-assistant" && (
        <div className="h-[calc(100vh-100px)]">
          <AIAssistant />
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
