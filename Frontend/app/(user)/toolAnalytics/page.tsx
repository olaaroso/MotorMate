"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowDownUp, CalendarDays, Clock3, DollarSign, Download,
  Loader2, Package, RefreshCw, TrendingUp, XCircle,
} from "lucide-react";
import { auth } from "@/lib/firebase";

type Tool = {
  id: string;
  owner_id: string;
  item_name: string;
  price: number;
  availability: string;
};
type Rental = {
  id: string;
  listing_id: string;
  owner_id: string;
  renter_name: string;
  tool_name: string;
  start_date: string;
  end_date: string;
  created_at?: string;
  cancelled_at?: string;
  rental_days: number;
  rental_price: number;
  status: "pending" | "approved" | "pickup_pending" | "active" | "return_pending" | "completed" | "cancelled" | "rejected";
};
type Range = "all" | "30" | "90" | "year";
type SortKey = "name" | "booked" | "rentals" | "days" | "cancelled" | "requests";
type SortDirection = "asc" | "desc";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const dayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayCount = (start: string, end: string) => {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 86400000) + 1 : 0;
};
const dateLabel = (s: string) => s ? new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const statusLabel: Record<Rental["status"], string> = {
  pending: "Pending", approved: "Approved", pickup_pending: "Pickup waiting", active: "Active", return_pending: "Return waiting", completed: "Completed", cancelled: "Cancelled", rejected: "Rejected",
};
const booked = (r: Rental) => ["approved", "pickup_pending", "active", "return_pending", "completed"].includes(r.status);

// A CSV value that begins with a spreadsheet formula character must be escaped.
const csvCell = (value: string | number) => {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text) && typeof value === "string") text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
function downloadCsv(filename: string, headings: string[], rows: (string | number)[][]) {
  const content = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const file = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ToolAnalyticsPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [sortBy, setSortBy] = useState<SortKey>("booked");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [toolFilter, setToolFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const today = dayString();

  useEffect(() => {
    let ignore = false;
    const stop = onAuthStateChanged(auth, async (user) => {
      if (ignore) return;
      setUid(user?.uid ?? null);
      setTools([]);
      setRentals([]);
      setError("");
      if (!user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [t, r] = await Promise.all([
          fetch(`${API}/api/diy/listings/owner/${encodeURIComponent(user.uid)}`, { cache: "no-store" }),
          fetch(`${API}/api/diy/rental-requests/owner/${encodeURIComponent(user.uid)}`, { cache: "no-store" }),
        ]);
        if (!t.ok || !r.ok) {
          const failing = t.ok ? r : t;
          const body = await failing.json().catch(() => ({}));
          throw new Error(body.detail || "Could not load owner analytics.");
        }
        const [toolData, rentalData] = await Promise.all([t.json(), r.json()]);
        if (!ignore) {
          setTools(Array.isArray(toolData.results) ? toolData.results : []);
          setRentals(Array.isArray(rentalData.results) ? rentalData.results : []);
        }
      } catch (e) {
        if (!ignore) setError(e instanceof Error ? e.message : "Unable to load analytics.");
      } finally {
        if (!ignore) setLoading(false);
      }
    });
    return () => { ignore = true; stop(); };
  }, [refreshKey]);

  const cutoff = useMemo(() => {
    if (range === "all") return "";
    if (range === "year") return `${today.slice(0, 4)}-01-01`;
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - Number(range) + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [range, today]);

  // Filter by the rental's start date, not request creation date.
  const periodRentals = useMemo(() => rentals.filter((r) =>
    (!cutoff || (r.start_date >= cutoff && r.start_date <= today)) &&
    (toolFilter === "all" || r.listing_id === toolFilter)
  ), [rentals, cutoff, today, toolFilter]);

  const stats = useMemo(() => {
    const valid = periodRentals.filter(booked);
    const cancelled = periodRentals.filter((r) => r.status === "cancelled");
    const planned = valid.filter((r) => r.start_date > today);
    const historical = valid.filter((r) => r.status === "completed");
    const actualDateDays = (r: Rental) => dayCount(r.start_date, r.end_date) || Number(r.rental_days || 0);
    return {
      requests: periodRentals.length,
      bookedCount: valid.length,
      value: valid.reduce((s, r) => s + Number(r.rental_price || 0), 0),
      days: valid.reduce((s, r) => s + actualDateDays(r), 0),
      cancelled: cancelled.length,
      rejected: periodRentals.filter((r) => r.status === "rejected").length,
      pending: periodRentals.filter((r) => r.status === "pending").length,
      completed: historical.length,
      upcoming: planned.length,
      avgValue: valid.length ? valid.reduce((s, r) => s + Number(r.rental_price || 0), 0) / valid.length : 0,
    };
  }, [periodRentals, today]);

  const toolRows = useMemo(() => {
    const byTool = new Map<string, { id: string; name: string; rate: number; requests: number; rentals: number; booked: number; days: number; cancelled: number; pending: number; completed: number }>();
    for (const t of tools) byTool.set(t.id, { id: t.id, name: t.item_name, rate: Number(t.price || 0), requests: 0, rentals: 0, booked: 0, days: 0, cancelled: 0, pending: 0, completed: 0 });
    for (const r of periodRentals) {
      const old = byTool.get(r.listing_id);
      const row = old || { id: r.listing_id, name: r.tool_name || "Deleted listing", rate: Number(r.rental_price || 0) / Math.max(1, Number(r.rental_days || 1)), requests: 0, rentals: 0, booked: 0, days: 0, cancelled: 0, pending: 0, completed: 0 };
      row.requests++;
      if (booked(r)) {
        row.rentals++;
        row.booked += Number(r.rental_price || 0);
        row.days += dayCount(r.start_date, r.end_date) || Number(r.rental_days || 0);
        if (r.status === "completed") row.completed++;
      }
      if (r.status === "cancelled") row.cancelled++;
      if (r.status === "pending") row.pending++;
      byTool.set(r.listing_id, row);
    }
    return [...byTool.values()]
      .filter((r) => toolFilter === "all" || r.id === toolFilter)
      .sort((a, b) => {
        const comparison = sortBy === "name" ? a.name.localeCompare(b.name) : a[sortBy] - b[sortBy];
        return direction === "asc" ? comparison : -comparison;
      });
  }, [tools, periodRentals, today, sortBy, direction, toolFilter]);

  const historyRows = useMemo(() => periodRentals
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .sort((a, b) => b.start_date.localeCompare(a.start_date)), [periodRentals, statusFilter]);

  const setSort = (key: SortKey) => {
    if (key === sortBy) setDirection((v) => v === "desc" ? "asc" : "desc");
    else { setSortBy(key); setDirection(key === "name" ? "asc" : "desc"); }
  };

  const statCards = [
    { title: "Booked rental value", value: money(stats.value), note: "Not confirmed payments", Icon: DollarSign },
    { title: "Rentals booked", value: stats.bookedCount.toString(), note: "Uncancelled reservations, including handoffs", Icon: Package },
    { title: "Rental days booked", value: stats.days.toString(), note: "Inclusive reservation days", Icon: CalendarDays },
    { title: "Cancellations", value: stats.cancelled.toString(), note: "All cancelled requests", Icon: XCircle },
    { title: "Total requests", value: stats.requests.toString(), note: `${stats.pending} pending · ${stats.rejected} rejected`, Icon: Clock3 },
    { title: "Average booked rental", value: money(stats.avgValue), note: `${stats.completed} confirmed returns`, Icon: TrendingUp },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">ToolDrop · Owner workspace</p>
          <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">Rental Analytics</h1>
          <p className="mt-2 text-sm text-gray-500">Rental history, booking value, and performance across your tools.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/myTools" className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-[#001F3F] hover:bg-gray-50">My Tools</Link>
          <button onClick={() => setRefreshKey((n) => n + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-[#001F3F] hover:bg-gray-50 disabled:opacity-50"><RefreshCw size={16} /> Refresh</button>
        </div>
      </div>

      {!uid && !loading && <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">Sign in to view your tool statistics.</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading ? <div className="flex items-center justify-center gap-3 rounded-2xl border bg-white p-16 text-gray-500"><Loader2 className="animate-spin" /> Loading tool analytics...</div> : uid && !error && <>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">Period (rental start date)
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} className="min-w-44 rounded-lg border px-3 py-2.5 text-sm font-medium text-gray-800">
              <option value="all">All time</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="year">This calendar year</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600">Tool
            <select value={toolFilter} onChange={(e) => setToolFilter(e.target.value)} className="min-w-52 max-w-64 rounded-lg border px-3 py-2.5 text-sm font-medium text-gray-800">
              <option value="all">All tools</option>
              {tools.map((t) => <option key={t.id} value={t.id}>{t.item_name}</option>)}
            </select>
          </label>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={() => downloadCsv("motormate-tool-summary.csv", ["Tool", "Daily rate", "Requests", "Booked rentals", "Booked rental value", "Booked days", "Cancelled", "Pending", "Confirmed completed"], toolRows.map((r) => [r.name, r.rate, r.requests, r.rentals, r.booked, r.days, r.cancelled, r.pending, r.completed]))} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"><Download size={16}/> Tool CSV</button>
            <button onClick={() => downloadCsv("motormate-rental-history.csv", ["Tool", "Renter", "Start", "End", "Status", "Days", "Rental value", "Request ID"], historyRows.map((r) => [r.tool_name, r.renter_name, r.start_date, r.end_date, r.status, dayCount(r.start_date,r.end_date) || r.rental_days, r.rental_price, r.id]))} className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#003366]"><Download size={16}/> History CSV</button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {statCards.map(({ title, value, note, Icon }) => <div key={title} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-4 inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon size={20}/></div>
            <p className="text-sm text-gray-500">{title}</p><p className="mt-1 text-3xl font-bold text-[#001F3F]">{value}</p>
            <p className="mt-2 text-xs text-gray-400">{note}</p>
          </div>)}
        </div>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-5"><h2 className="text-lg font-bold text-[#001F3F]">Performance by tool</h2><p className="mt-1 text-sm text-gray-500">Click a column heading to sort. Cancelled requests are excluded from booked value.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr>
              {([ ["name", "Tool"], ["requests", "Requests"], ["rentals", "Booked rentals"], ["booked", "Booked value"], ["days", "Days booked"], ["cancelled", "Cancelled"] ] as [SortKey,string][]).map(([key,label]) => <th key={key} scope="col" className="px-4 py-3"><button onClick={() => setSort(key)} className="inline-flex items-center gap-1 font-semibold hover:text-blue-700">{label}<ArrowDownUp size={13}/></button></th>)}
            </tr></thead><tbody className="divide-y">
              {toolRows.map((r) => <tr key={r.id} className="hover:bg-gray-50"><td className="px-4 py-4 font-semibold text-[#001F3F]">{r.name}</td><td className="px-4 py-4">{r.requests}</td><td className="px-4 py-4">{r.rentals}</td><td className="px-4 py-4 font-semibold text-emerald-700">{money(r.booked)}</td><td className="px-4 py-4">{r.days}</td><td className="px-4 py-4">{r.cancelled}</td></tr>)}
              {toolRows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No tools or rentals to display.</td></tr>}
            </tbody></table></div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-5"><div><h2 className="text-lg font-bold text-[#001F3F]">Rental history</h2><p className="mt-1 text-sm text-gray-500">All statuses, including pending and cancelled requests.</p></div>
            <select aria-label="Filter rental status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm text-gray-700"><option value="all">All statuses</option>{Object.entries(statusLabel).map(([key,value]) => <option key={key} value={key}>{value}</option>)}</select>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[870px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500"><tr>{["Tool", "Borrower", "Start", "End", "Status", "Days", "Rental value"].map((t) => <th scope="col" key={t} className="px-4 py-3 font-semibold">{t}</th>)}</tr></thead><tbody className="divide-y">
            {historyRows.map((r) => <tr key={r.id} className="hover:bg-gray-50"><td className="px-4 py-4 font-semibold text-[#001F3F]">{r.tool_name}</td><td className="px-4 py-4">{r.renter_name}</td><td className="px-4 py-4">{dateLabel(r.start_date)}</td><td className="px-4 py-4">{dateLabel(r.end_date)}</td><td className="px-4 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{statusLabel[r.status] || r.status}</span></td><td className="px-4 py-4">{dayCount(r.start_date, r.end_date) || r.rental_days}</td><td className="px-4 py-4 font-semibold">{money(Number(r.rental_price || 0))}</td></tr>)}
            {historyRows.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No rental history matches these filters.</td></tr>}
          </tbody></table></div>
        </section>
        <p className="text-xs leading-5 text-gray-500">Financial figures represent reserved rental prices, not processed payments, profit, or deposits. Cancelled/rejected/pending requests count toward request history but not booked value. Date filters use rental start dates; the All time view includes future reservations. Deleted tools with historical rentals remain in the summary.</p>
      </>}
    </div>
  );
}
