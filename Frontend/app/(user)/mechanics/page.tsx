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
  Store,
  Wrench,
} from "lucide-react";

import { auth } from "@/lib/firebase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const VISIBLE_SERVICE_COUNT = 4;

type Mechanic = {
  id: string;
  owner_id: string;
  shop_name?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  address?: string;
  phone?: string | null;
  services_offered?: string[];
  price_per_hour?: number | null;
  operating_hours?: Record<string, string> | null;
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

function formatAddress(mechanic: Mechanic) {
  const street = mechanic.street_address?.trim() || "";
  const city = mechanic.city?.trim() || "";
  const state = mechanic.state?.trim().toUpperCase() || "";
  const zip = mechanic.zip_code?.trim() || "";

  if (street || city || state || zip) {
    const locality = [state, zip].filter(Boolean).join(" ");
    const cityLine = [city, locality].filter(Boolean).join(", ");
    return [street, cityLine].filter(Boolean).join(", ");
  }

  return mechanic.address?.trim() || "Location not listed";
}

export default function FindMechanicsPage() {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");

  const [zipInput, setZipInput] = useState("");
  const [serviceInput, setServiceInput] = useState("");
  const [appliedZip, setAppliedZip] = useState("");
  const [appliedService, setAppliedService] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? "");
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setServicesLoading(true);
        const response = await fetch(`${apiUrl}/api/mechanics/services`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.detail || "Failed to load services.");
        }

        if (!cancelled) {
          setServiceOptions(Array.isArray(data.services) ? data.services : []);
        }
      } catch (err) {
        console.error("Failed to load mechanic services:", err);
        if (!cancelled) setServiceOptions([]);
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
    const zip = zipInput.trim();

    if (zip && !/^\d{5}$/.test(zip)) {
      setFilterError("ZIP code must contain exactly 5 digits.");
      return;
    }

    setFilterError("");
    setAppliedZip(zip);
    setAppliedService(serviceInput);
  };

  const clearFilters = () => {
    setZipInput("");
    setServiceInput("");
    setAppliedZip("");
    setAppliedService("");
    setFilterError("");
  };

  const hasFilters = Boolean(appliedZip || appliedService);

  return (
    <div className="mx-auto max-w-7xl p-8">
      <section>
        <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-blue-600">
          Find Mechanics
        </p>
        <h1 className="text-3xl font-bold text-[#001F3F]">
          Compare local repair shops.
        </h1>
        <p className="mt-2 max-w-2xl text-gray-500">
          Choose the service you need, optionally narrow by ZIP code, and compare
          shops that can perform the work.
        </p>
      </section>

      <section className="mt-8 rounded-2xl bg-[#001F3F] p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white">What do you need done?</h2>
          <p className="mt-1 text-sm text-blue-100">
            Select a service offered on MotorMate. ZIP code is optional.
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid gap-3 lg:grid-cols-[1fr_240px_auto]"
        >
          <div className="flex items-center rounded-xl bg-white px-4">
            <Wrench size={19} className="mr-3 shrink-0 text-gray-400" />
            <select
              value={serviceInput}
              onChange={(event) => setServiceInput(event.target.value)}
              disabled={servicesLoading}
              className="w-full bg-transparent py-4 text-sm text-gray-700 outline-none disabled:text-gray-400"
            >
              <option value="">
                {servicesLoading ? "Loading services..." : "All services"}
              </option>
              {serviceOptions.map((service) => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center rounded-xl bg-white px-4">
            <MapPin size={19} className="mr-3 text-gray-400" />
            <input
              type="text"
              inputMode="numeric"
              placeholder="ZIP code (optional)"
              value={zipInput}
              maxLength={5}
              onChange={(event) =>
                setZipInput(event.target.value.replace(/\D/g, "").slice(0, 5))
              }
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

        {filterError && (
          <p className="mt-3 text-sm font-medium text-red-200">{filterError}</p>
        )}
      </section>

      <section className="mt-9">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#001F3F]">
              {appliedZip ? "Mechanics Near You" : "Available Repair Shops"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters ? (
                <>
                  Showing shops
                  {appliedService && (
                    <> offering <strong className="text-gray-800">{appliedService}</strong></>
                  )}
                  {appliedZip && (
                    <> in <strong className="text-gray-800">{appliedZip}</strong></>
                  )}
                </>
              ) : (
                "All shops currently listed on MotorMate."
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
          <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white text-gray-500">
            <Loader2 size={22} className="mr-3 animate-spin" />
            Loading mechanics...
          </div>
        ) : mechanics.length === 0 ? (
          !error && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Store size={34} className="mx-auto text-gray-300" />
              <h3 className="mt-3 text-base font-semibold text-gray-800">
                No mechanics found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {hasFilters
                  ? "Try another service, clear the ZIP filter, or search a different ZIP code."
                  : "No shops have set up a MotorMate profile yet."}
              </p>
            </div>
          )
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {mechanics.map((mechanic) => {
              const services = mechanic.services_offered || [];
              const hours = groupHours(mechanic.operating_hours);
              const acceptsRequests = hours.length > 0 && services.length > 0;
              const laborRate =
                mechanic.price_per_hour !== undefined && mechanic.price_per_hour !== null
                  ? `$${mechanic.price_per_hour}/hr`
                  : "Rate not listed";

              const hrefParams = new URLSearchParams();
              if (appliedService) hrefParams.set("service", appliedService);
              const hrefQuery = hrefParams.toString();

              return (
                <article
                  key={mechanic.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
                >
                  <div className="border-b border-slate-100 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
                          <Store size={22} />
                        </div>
                        <div>
                        <h3 className="text-lg font-bold text-[#001F3F]">
                          {mechanic.shop_name || "Unnamed Shop"}
                        </h3>
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                          <MapPin size={15} className="mt-0.5 shrink-0" />
                          {formatAddress(mechanic)}
                        </p>
                          {mechanic.phone && (
                            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                              <Phone size={15} className="shrink-0" />
                              {mechanic.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      {userId && mechanic.owner_id === userId && (
                        <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#001F3F]">
                          Your Shop
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-5 p-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <DollarSign size={14} /> Labor Rate
                        </p>
                        <p className="mt-1 text-base font-bold text-slate-800">{laborRate}</p>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          <Clock size={14} /> Hours
                        </p>
                        {hours.length === 0 ? (
                          <p className="mt-1 text-sm text-slate-500">Hours not listed</p>
                        ) : (
                          <div className="mt-1 space-y-0.5">
                            {hours.map((group) => (
                              <div key={group.start} className="flex justify-between gap-3 text-xs">
                                <span className="font-semibold text-slate-700">
                                  {group.start === group.end
                                    ? DAY_LABELS[group.start]
                                    : `${DAY_LABELS[group.start]} – ${DAY_LABELS[group.end]}`}
                                </span>
                                <span className={group.time === "Closed" ? "italic text-slate-400" : "text-slate-500"}>
                                  {group.time}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <Wrench size={14} /> Services
                      </p>
                      {services.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No services listed</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {services.slice(0, VISIBLE_SERVICE_COUNT).map((service) => (
                            <span
                              key={service}
                              className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#001F3F]"
                            >
                              {service}
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

                    <div className="mt-auto border-t border-slate-100 pt-5">
                      <p className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarDays size={16} className="text-[#001F3F]" />
                        {acceptsRequests
                          ? "Book 30-minute appointments during shop hours."
                          : "Online requests are not available until services and hours are configured."}
                      </p>

                      <Link
                        href={`/mechanics/${encodeURIComponent(mechanic.owner_id)}${hrefQuery ? `?${hrefQuery}` : ""}`}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]"
                      >
                        {userId && mechanic.owner_id === userId
                          ? "View Your Shop"
                          : "View Shop & Request"}
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
