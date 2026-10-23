"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type AppointmentSlot = {
  id: string;
  owner_id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" (24-hour)
  status: "available" | "booked";
  created_at?: string;
};

// 30-minute options, matching the Operating Hours selects on the shop page.
// Values are 24-hour "HH:MM" (what the API stores); labels are 12-hour.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const value = `${String(hour).padStart(2, "0")}:${minute}`;
  return { value, label: formatTime(value) };
});

function getTodayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().split("T")[0];
}

function formatTime(time: string) {
  const [hourText, minute = "00"] = time.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return time;
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${ampm}`;
}

function formatDate(dateString: string) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AppointmentAvailability({
  ownerId,
}: {
  ownerId: string;
}) {
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const today = getTodayString();

  useEffect(() => {
    if (!ownerId) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `${apiUrl}/api/mechanics/${ownerId}/availability`
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail || "Failed to load your appointment availability."
          );
        }

        if (!cancelled) setSlots(data.results || []);
      } catch (err) {
        console.error("Failed to load appointment slots:", err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load your appointment availability."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  const flashSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(""), 2500);
  };

  const handleAddSlot = async () => {
    setError("");
    setSuccess("");

    if (!newDate) {
      setError("Choose a date for the appointment slot.");
      return;
    }

    if (newDate < today) {
      setError("Appointment slots cannot be in the past.");
      return;
    }

    const duplicate = slots.some(
      (slot) => slot.date === newDate && slot.time === newTime
    );

    if (duplicate) {
      setError("You already have an appointment slot at that date and time.");
      return;
    }

    try {
      setAdding(true);

      const response = await fetch(
        `${apiUrl}/api/mechanics/${ownerId}/availability`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: newDate, time: newTime }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Failed to add appointment slot.");
      }

      setSlots((current) =>
        [...current, data.slot as AppointmentSlot].sort((a, b) =>
          a.date === b.date
            ? a.time.localeCompare(b.time)
            : a.date.localeCompare(b.date)
        )
      );
      flashSuccess("Appointment slot added.");
    } catch (err) {
      console.error("Failed to add appointment slot:", err);
      setError(
        err instanceof Error ? err.message : "Failed to add appointment slot."
      );
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSlot = async (slot: AppointmentSlot) => {
    setError("");
    setSuccess("");

    try {
      setDeletingId(slot.id);

      const response = await fetch(
        `${apiUrl}/api/mechanics/${ownerId}/availability/${slot.id}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Failed to remove appointment slot.");
      }

      setSlots((current) => current.filter((item) => item.id !== slot.id));
      flashSuccess("Appointment slot removed.");
    } catch (err) {
      console.error("Failed to remove appointment slot:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove appointment slot."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Group slots by date for display; `slots` is already sorted by the API.
  const groupedSlots = useMemo(() => {
    const groups = new Map<string, AppointmentSlot[]>();
    for (const slot of slots) {
      const existing = groups.get(slot.date);
      if (existing) {
        existing.push(slot);
      } else {
        groups.set(slot.date, [slot]);
      }
    }
    return Array.from(groups.entries());
  }, [slots]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
          <CalendarDays size={20} />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#001F3F]">
            Appointment Availability
          </h2>
          <p className="text-sm text-slate-500">
            Add specific dates and times customers can book. Slots save
            automatically.
          </p>
        </div>
      </div>

      {success && (
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ADD SLOT */}
      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="text-sm font-semibold text-slate-700">Date</label>
          <input
            type="date"
            min={today}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700">Time</label>
          <div className="relative mt-2">
            <Clock
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddSlot}
          disabled={adding || loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {adding ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <CalendarPlus size={16} />
              Add Slot
            </>
          )}
        </button>
      </div>

      {/* SLOT LIST */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-200 p-8 text-sm text-slate-500">
            <Loader2 size={18} className="mr-2 animate-spin" />
            Loading your availability...
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
            <CalendarDays size={28} className="text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              No appointment slots yet
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Add a date and time above. Customers will only be able to request
              appointments at the slots you list here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">
                Available Slots
              </p>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#001F3F]">
                {slots.length}
              </span>
            </div>

            {groupedSlots.map(([date, dateSlots]) => (
              <div
                key={date}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <p className="text-sm font-semibold text-slate-800">
                  {formatDate(date)}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {dateSlots.map((slot) => {
                    const deleting = deletingId === slot.id;

                    return (
                      <div
                        key={slot.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-1.5 text-sm font-medium text-slate-700 shadow-sm"
                      >
                        <Clock size={14} className="text-slate-400" />
                        {formatTime(slot.time)}

                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(slot)}
                          disabled={deleting}
                          aria-label={`Remove ${formatTime(slot.time)} slot on ${formatDate(date)}`}
                          title="Remove slot"
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
