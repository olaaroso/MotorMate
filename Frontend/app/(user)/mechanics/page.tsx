"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  Phone,
  Star,
  Store,
  Wrench,
} from "lucide-react";

import { auth } from "@/lib/firebase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const VISIBLE_SLOT_COUNT = 6;
const VISIBLE_SERVICE_COUNT = 4;

type AvailableSlot = {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" (24-hour)
  status: "available";
};

type Mechanic = {
  id: string;
  owner_id: string;
  shop_name?: string;
  address?: string;
  phone?: string | null;
  services_offered?: string[];
  price_per_hour?: number | null;
  operating_hours?: Record<string, string> | null;
  rating?: number;
  available_slots: AvailableSlot[];
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function getLocalNow() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  const iso = new Date(now.getTime() - offset).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function formatTime(time: string) {
  const [hourText, minute = "00"] = time.split(":");
  const hour = Number(hourText);
  if (Number.isNaN(hour)) return time;
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${ampm}`;
}

function formatSlotDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupHours(hours?: Record<string, string> | null) {
  if (!hours || !DAYS.some((day) => hours[day]?.trim())) return [];

  const groups: { start: string; end: string; time: string }[] = [];

  for (const day of DAYS) {
    const time = hours[day]?.trim() || "Closed";
    const last = groups[groups.length - 1];

    if (last && last.time === time) {
      last.end = day;
    } else {
      groups.push({ start: day, end: day, time });
    }
  }

  return groups;
}

export default function FindMechanicsPage() {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [zipInput, setZipInput] = useState("");
  const [serviceInput, setServiceInput] = useState("");
  const [appliedZip, setAppliedZip] = useState("");
  const [appliedService, setAppliedService] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? "");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userId === null) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();
        if (appliedZip) params.append("zip_code", appliedZip);
        if (appliedService) params.append("service", appliedService);
        if (userId) params.append("exclude_owner_id", userId);

        const response = await fetch(`${apiUrl}/api/mechanics?${params.toString()}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.detail || "Failed to load mechanics.");
        }

        if (!cancelled) setMechanics(data.results || []);
      } catch (err) {
        console.error("Failed to load mechanics:", err);
        if (!cancelled) {
          setMechanics([]);
          setError(err instanceof Error ? err.message : "Failed to load mechanics.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, appliedZip, appliedService]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setAppliedZip(zipInput.trim());
    setAppliedService(serviceInput.trim());
  };

  const clearFilters = () => {
    setZipInput("");
    setServiceInput("");
    setAppliedZip("");
    setAppliedService("");
  };

  const hasFilters = !!appliedZip || !!appliedService;
  const now = getLocalNow();

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* HEADER */}
      <section>
        <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-blue-600">
          Find Mechanics
        </p>

        <h1 className="text-3xl font-bold text-[#001F3F]">
          Compare local repair shops.
        </h1>

        <p className="mt-2 max-w-2xl text-gray-500">
          Browse shops near you, compare services and labor rates, and see
          when each mechanic has open appointments.
        </p>
      </section>

      {/* SEARCH */}
      <section className="mt-8 rounded-2xl bg-[#001F3F] p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white">
            What do you need done?
          </h2>
          <p className="mt-1 text-sm text-blue-100">
            Filter by ZIP code, service, or both.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid gap-3 lg:grid-cols-[1fr_260px_auto]"
        >
          <div className="flex items-center rounded-xl bg-white px-4">
            <Wrench size={19} className="mr-3 text-gray-400" />
            <input
              type="text"
              placeholder="Service, e.g. oil, brake, diagnostic..."
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              className="w-full bg-transparent py-4 text-sm text-gray-700 outline-none"
            />
          </div>

          <div className="flex items-center rounded-xl bg-white px-4">
            <MapPin size={19} className="mr-3 text-gray-400" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="ZIP code"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              className="w-full bg-transparent py-4 text-sm text-gray-700 outline-none"
            />
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-semibold text-[#001F3F] transition hover:bg-gray-100"
          >
            Search
            <ArrowRight size={17} />
          </button>
        </form>
      </section>

      {/* RESULTS */}
      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#001F3F]">
              Mechanics Near You
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters ? (
                <>
                  Showing results
                  {appliedService && (
                    <>
                      {" "}for <strong className="text-gray-800">{appliedService}</strong>
                    </>
                  )}
                  {appliedZip && (
                    <>
                      {" "}in <strong className="text-gray-800">{appliedZip}</strong>
                    </>
                  )}
                </>
              ) : (
                "All shops on MotorMate."
              )}
            </p>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-[#001F3F] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white text-gray-500">
            <Loader2 size={22} className="mr-3 animate-spin" />
            Loading mechanics...
          </div>
        ) : mechanics.length === 0 ? (
          !error && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Store size={36} className="mx-auto text-gray-300" />
              <h3 className="mt-3 text-base font-semibold text-gray-800">
                No mechanics found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasFilters
                  ? "Try a different ZIP code or a broader service keyword."
                  : "No shops have set up a MotorMate profile yet."}
              </p>
            </div>
          )
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {mechanics.map((mechanic) => {
              const services = mechanic.services_offered || [];
              const hours = groupHours(mechanic.operating_hours);

              const slots = mechanic.available_slots.filter(
                (slot) =>
                  slot.date > now.date ||
                  (slot.date === now.date && slot.time > now.time)
              );
              const expanded = !!expandedSlots[mechanic.id];
              const visibleSlots = expanded
                ? slots
                : slots.slice(0, VISIBLE_SLOT_COUNT);

              const laborRate =
                mechanic.price_per_hour !== undefined &&
                mechanic.price_per_hour !== null
                  ? `$${mechanic.price_per_hour}/hr`
                  : "Rate not listed";

              return (
                <article
                  key={mechanic.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                >
                  {/* SHOP HEADER */}
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
                        <Store size={22} />
                      </div>

                      <div>
                        <h3 className="text-lg font-bold text-[#001F3F]">
                          {mechanic.shop_name || "Unnamed Shop"}
                        </h3>

                        {mechanic.address && (
                          <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                            <MapPin size={15} className="mt-0.5 shrink-0" />
                            {mechanic.address}
                          </p>
                        )}

                        {mechanic.phone && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                            <Phone size={15} className="shrink-0" />
                            {mechanic.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {typeof mechanic.rating === "number" && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-700">
                        <Star size={14} className="fill-amber-400 text-amber-400" />
                        {mechanic.rating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-5 p-6">
                    {/* RATE + HOURS */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <DollarSign size={14} />
                          Labor Rate
                        </p>
                        <p className="mt-1 text-base font-bold text-slate-800">
                          {laborRate}
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <Clock size={14} />
                          Hours
                        </p>
                        {hours.length === 0 ? (
                          <p className="mt-1 text-sm text-slate-500">
                            Hours not listed
                          </p>
                        ) : (
                          <div className="mt-1 space-y-0.5">
                            {hours.map((group) => (
                              <div
                                key={group.start}
                                className="flex justify-between gap-3 text-xs"
                              >
                                <span className="font-semibold text-slate-700">
                                  {group.start === group.end
                                    ? DAY_LABELS[group.start]
                                    : `${DAY_LABELS[group.start]} – ${DAY_LABELS[group.end]}`}
                                </span>
                                <span
                                  className={
                                    group.time === "Closed"
                                      ? "italic text-slate-400"
                                      : "text-slate-500"
                                  }
                                >
                                  {group.time}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SERVICES */}
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <Wrench size={14} />
                        Services
                      </p>

                      {services.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          No services listed
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {services.slice(0, VISIBLE_SERVICE_COUNT).map((serviceName) => (
                            <span
                              key={serviceName}
                              className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#001F3F]"
                            >
                              {serviceName}
                            </span>
                          ))}
                          {services.length > VISIBLE_SERVICE_COUNT && (
                            <span
                              title={services.slice(VISIBLE_SERVICE_COUNT).join(", ")}
                              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500"
                            >
                              +{services.length - VISIBLE_SERVICE_COUNT} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* AVAILABLE APPOINTMENTS (display-only) */}
                    <div className="mt-auto border-t border-slate-100 pt-5">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <CalendarDays size={16} className="text-[#001F3F]" />
                          Available Appointments
                        </p>
                        <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          {slots.length}
                        </span>
                      </div>

                      {slots.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center text-sm text-slate-500">
                          No open appointments right now.
                        </p>
                      ) : (
                        <>
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {visibleSlots.map((slot) => (
                              <li key={slot.id}>
                                <Link
                                  href={`/mechanics/${encodeURIComponent(mechanic.owner_id)}?slot=${slot.id}`}
                                  className="block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#001F3F] hover:bg-blue-50"
                                >
                                  {formatSlotDate(slot.date)}
                                  <span className="mx-1.5 text-slate-300">•</span>
                                  {formatTime(slot.time)}
                                </Link>
                              </li>
                            ))}
                          </ul>

                          {slots.length > VISIBLE_SLOT_COUNT && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSlots((prev) => ({
                                  ...prev,
                                  [mechanic.id]: !expanded,
                                }))
                              }
                              className="mt-3 text-sm font-semibold text-[#001F3F] hover:underline"
                            >
                              {expanded
                                ? "Show fewer"
                                : `Show all (${slots.length})`}
                            </button>
                          )}
                        </>
                      )}

                      <Link
                        href={`/mechanics/${encodeURIComponent(mechanic.owner_id)}`}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]"
                      >
                        View Shop &amp; Request
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
