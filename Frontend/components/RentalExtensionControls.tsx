"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, DollarSign, Loader2, X } from "lucide-react";
import { auth } from "@/lib/firebase";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Availability = {
  current_end_date: string;
  first_extension_day: string;
  available_through: string | null;
  next_booking_start: string | null;
  can_extend: boolean;
  daily_rate: number;
  pending_request: { status: string; requested_end_date: string } | null;
  message: string;
};

type Props = {
  rental: {
    id: string;
    status: string;
    end_date: string;
    extension_request?: { status?: string; requested_end_date?: string };
  };
  onUpdated: () => Promise<unknown> | void;
};

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(iso: string) {
  return localDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function addDays(iso: string, days: number) {
  const date = localDate(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function dayDifference(start: string, end: string) {
  const parts = (value: string) => value.split("-").map(Number);
  const [sy, sm, sd] = parts(start);
  const [ey, em, ed] = parts(end);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000);
}

function calendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export default function RentalExtensionControls({ rental, onUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // Keep the return confirmation visible separately; this control is only for active rentals.
  const pending = rental.extension_request?.status === "pending";
  const today = isoDate(new Date());
  const firstPossibleDay = availability?.first_extension_day || addDays(rental.end_date, 1);
  const minDate = firstPossibleDay > addDays(today, 1) ? firstPossibleDay : addDays(today, 1);
  const monthDays = useMemo(() => calendarDays(calendarMonth), [calendarMonth]);
  const additionalDays = newDate ? Math.max(0, dayDifference(rental.end_date, newDate)) : 0;
  const dailyRate = availability?.daily_rate;
  const addedCost = dailyRate !== undefined ? Math.round(additionalDays * dailyRate * 100) / 100 : null;
  const money = (value: number) => value.toLocaleString(undefined, { style: "currency", currency: "USD" });

  async function checkAvailability() {
    const user = auth.currentUser;
    if (!user) { setError("Please sign in again."); return; }
    setOpen(true);
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API}/api/diy/rental-requests/${encodeURIComponent(rental.id)}/extension-availability?renter_id=${encodeURIComponent(user.uid)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to check availability.");
      setAvailability(data as Availability);
      setNewDate("");
      const earliest = data.first_extension_day > addDays(today, 1) ? data.first_extension_day : addDays(today, 1);
      const date = localDate(earliest);
      setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    } catch (e) {
      setAvailability(null);
      setError(e instanceof Error ? e.message : "Unable to check availability.");
    } finally { setLoading(false); }
  }

  async function submit() {
    const user = auth.currentUser;
    if (!user) { setError("Please sign in again."); return; }
    if (!availability?.available_through || !newDate || newDate < minDate || newDate > availability.available_through) {
      setError("Select an available new return date."); return;
    }
    if (dailyRate === undefined || !Number.isFinite(dailyRate) || dailyRate < 0) {
      setError("Unable to verify the daily rental rate. Please refresh and try again."); return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/diy/rental-requests/${encodeURIComponent(rental.id)}/extension`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renter_id: user.uid, requested_end_date: newDate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to request extension.");
      setNotice("Extension request sent. Your current return date and rental total will change only if the owner approves.");
      await onUpdated();
      setAvailability(null);
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to request extension."); }
    finally { setLoading(false); }
  }

  if (rental.status !== "active") return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-bold text-[#001F3F]"><CalendarClock size={17}/> Need more time?</h4>
          <p className="mt-1 text-xs text-slate-600">Request additional rental days. Your drop-off confirmation is still available above.</p>
        </div>
        <button type="button" disabled={loading || pending} onClick={() => open ? setOpen(false) : void checkAvailability()}
          className="inline-flex items-center gap-2 rounded-xl border border-[#001F3F] bg-white px-4 py-2.5 text-sm font-semibold text-[#001F3F] hover:bg-slate-50 disabled:opacity-50">
          {open ? <X size={16}/> : <CalendarClock size={16}/>} {open ? "Close" : "Request Extension"}
        </button>
      </div>
      {pending && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">Your request to extend through {rental.extension_request?.requested_end_date} is awaiting the owner's decision. Your current return date has not changed.</p>}
      {open && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          {loading && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={16}/> {availability ? "Sending request..." : "Checking availability..."}</p>}
          {availability && !loading && (
            !availability.can_extend || !availability.available_through || availability.available_through < minDate ? (
              <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                <AlertTriangle size={16} className="mr-2 inline"/> Sorry, an extension is unavailable. This tool is already booked on the next available extension day.
              </p>
            ) : (
              <div className="space-y-4">
                <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  Available from <strong>{formatDate(minDate)}</strong> through <strong>{formatDate(availability.available_through)}</strong>.
                  {availability.next_booking_start && <> Another confirmed booking begins {formatDate(availability.next_booking_start)}.</>}
                </p>
                <div className="mx-auto w-full max-w-[400px] rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <button type="button" aria-label="Previous month" disabled={calendarMonth.getFullYear() === localDate(minDate).getFullYear() && calendarMonth.getMonth() === localDate(minDate).getMonth()}
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="rounded-lg border p-2 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft size={17}/></button>
                    <div className="text-center">
                      <p className="font-bold text-[#001F3F]">{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                      <p className="mt-0.5 text-xs text-gray-400">Select your new return date</p>
                    </div>
                    <button type="button" aria-label="Next month" disabled={calendarMonth.getFullYear() === localDate(availability.available_through).getFullYear() && calendarMonth.getMonth() === localDate(availability.available_through).getMonth()}
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      className="rounded-lg border p-2 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight size={17}/></button>
                  </div>
                  <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-gray-400">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div key={day} className="py-2">{day}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthDays.map(day => {
                      const iso = isoDate(day);
                      const sameMonth = day.getMonth() === calendarMonth.getMonth();
                      // Capture nullable availability fields safely inside the map callback.
                      const nextBookingStart = availability?.next_booking_start ?? null;
                      const availableThrough = availability?.available_through ?? "";
                      const reserved = !!nextBookingStart && iso >= nextBookingStart;
                      const unavailable = iso < minDate || iso > availableThrough;
                      const disabled = !sameMonth || unavailable;
                      const selected = iso === newDate;
                      return <button key={iso} type="button" disabled={disabled} title={reserved ? "Reserved" : unavailable ? "Unavailable for an extension" : undefined}
                        onClick={() => { setNewDate(iso); setError(""); }}
                        className={[
                          "aspect-square rounded-lg text-sm transition",
                          !sameMonth ? "text-transparent" : "",
                          reserved && sameMonth ? "cursor-not-allowed bg-red-50 font-semibold text-red-400 line-through" : "",
                          unavailable && !reserved && sameMonth ? "cursor-not-allowed text-gray-300" : "",
                          selected ? "bg-[#001F3F] font-bold text-white" : "",
                          !disabled && !selected ? "hover:bg-blue-50" : "",
                        ].join(" ")}>{sameMonth ? day.getDate() : ""}</button>;
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs">
                    <span className="flex items-center gap-2 text-gray-500"><span className="h-3 w-3 rounded-sm bg-red-100"/> Reserved</span>
                    <span className="flex items-center gap-2 text-gray-500"><span className="h-3 w-3 rounded-sm bg-[#001F3F]"/> Selected</span>
                  </div>
                  {newDate && <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-800">New return date: {formatDate(newDate)}</p>}
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <h5 className="flex items-center gap-2 font-bold text-[#001F3F]"><DollarSign size={17}/> Extension Cost</h5>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-600"><span>Daily rental rate</span><strong>{money(availability.daily_rate)}</strong></div>
                  <div className="mt-2 flex items-center justify-between text-sm text-slate-600"><span>Additional days</span><strong>{additionalDays}</strong></div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm"><strong>Additional rental charge</strong><strong className="text-lg text-[#001F3F]">{addedCost === null ? "Unavailable" : money(addedCost)}</strong></div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">If the owner approves, this amount will be added to your recorded rental total for the {additionalDays} additional {additionalDays === 1 ? "day" : "days"}. Your deposit is not charged again. MotorMate currently records the charge but does not automatically collect payment.</p>
                </div>
                <button disabled={!newDate || loading || addedCost === null} onClick={() => void submit()} type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  <CheckCircle2 size={16}/> Send Extension Request
                </button>
                <p className="text-xs text-slate-500">The owner must approve. We recheck reservations before final approval.</p>
              </div>
            )
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}
    </div>
  );
}
