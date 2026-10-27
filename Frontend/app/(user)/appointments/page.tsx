"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowRight,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Store,
  Gauge,
  Trash2,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import StatCard from "@/components/StatCard";
import { auth } from "@/lib/firebase";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type RequestStatus = "pending" | "accepted" | "declined" | "completed";
type RequestFilter = "all" | RequestStatus;

type VehicleSummary = {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  current_mileage?: string | number | null;
};

type ServiceRequest = {
  id: string;
  customer_id: string;
  mechanic_id: string;
  shop_name?: string;
  shop_address?: string;
  vehicle_summary?: VehicleSummary;
  appointment_date: string;
  appointment_start_time: string;
  appointment_end_time: string;
  service_requested: string;
  problem_description?: string;
  status: RequestStatus;
  status_reason?: string;
  created_at?: string;
  responded_at?: string;
  completed_at?: string;
  completed_mileage?: number;
  completed_cost?: number;
  completion_notes?: string;
};

type RequestsResponse = {
  results?: ServiceRequest[];
  detail?: string;
};

const FILTERS: Array<{ value: RequestFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
];

async function fetchCustomerRequests(customerId: string) {
  const response = await fetch(
    `${apiUrl}/api/service-requests/customer/${encodeURIComponent(customerId)}`
  );
  const data = (await response.json().catch(() => ({}))) as RequestsResponse;

  if (!response.ok) {
    throw new Error(data.detail || "Failed to load your appointments.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string) {
  const [hourText, minute = "00"] = value.split(":");
  const hour = Number(hourText);

  if (Number.isNaN(hour)) return value;

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return `${displayHour}:${minute} ${period}`;
}

function formatVehicle(summary?: VehicleSummary) {
  if (!summary) return "Vehicle details unavailable";

  return (
    [summary.year, summary.make, summary.model].filter(Boolean).join(" ") ||
    "Vehicle details unavailable"
  );
}

function mileageLabel(summary?: VehicleSummary) {
  const rawMileage = summary?.current_mileage;

  if (rawMileage === undefined || rawMileage === null || rawMileage === "") {
    return "Mileage not listed";
  }

  const mileage = Number(rawMileage);
  return Number.isFinite(mileage) && mileage >= 0
    ? `${mileage.toLocaleString()} mi`
    : "Mileage not listed";
}

function statusStyles(status: RequestStatus) {
  if (status === "completed") {
    return {
      label: "Completed",
      helper: "Service marked complete by the mechanic",
      className: "bg-blue-50 text-blue-700 ring-blue-100",
      icon: ClipboardCheck,
    };
  }

  if (status === "accepted") {
    return {
      label: "Accepted",
      helper: "Appointment confirmed",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      icon: CheckCircle2,
    };
  }

  if (status === "declined") {
    return {
      label: "Declined",
      helper: "Shop could not accept this request",
      className: "bg-red-50 text-red-700 ring-red-100",
      icon: XCircle,
    };
  }

  return {
    label: "Pending",
    helper: "Waiting for the shop to respond",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
    icon: Clock,
  };
}

export default function AppointmentsPage() {
  const [customerId, setCustomerId] = useState("");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [activeFilter, setActiveFilter] = useState<RequestFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingRequestId, setRemovingRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (!cancelled) {
          setCustomerId("");
          setRequests([]);
          setError("Sign in to view your appointments.");
          setLoading(false);
        }
        return;
      }

      const currentCustomerId = user.uid;

      if (!cancelled) {
        setCustomerId(currentCustomerId);
        setLoading(true);
        setError("");
      }

      void fetchCustomerRequests(currentCustomerId)
        .then((nextRequests) => {
          if (!cancelled) setRequests(nextRequests);
        })
        .catch((loadError) => {
          if (!cancelled) {
            setRequests([]);
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Failed to load your appointments."
            );
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter((request) => request.status === "pending").length,
      accepted: requests.filter((request) => request.status === "accepted").length,
      declined: requests.filter((request) => request.status === "declined").length,
      completed: requests.filter((request) => request.status === "completed").length,
    }),
    [requests]
  );

  const visibleRequests = useMemo(() => {
    const statusOrder: Record<RequestStatus, number> = {
      accepted: 0,
      pending: 1,
      declined: 2,
      completed: 3,
    };

    const filtered =
      activeFilter === "all"
        ? requests
        : requests.filter((request) => request.status === activeFilter);

    return [...filtered].sort((a, b) => {
      const statusDifference = statusOrder[a.status] - statusOrder[b.status];
      if (statusDifference !== 0) return statusDifference;

      if (a.status === "completed") {
        return (b.completed_at || "").localeCompare(a.completed_at || "");
      }

      return `${a.appointment_date}T${a.appointment_start_time}`.localeCompare(
        `${b.appointment_date}T${b.appointment_start_time}`
      );
    });
  }, [activeFilter, requests]);

  const refreshRequests = async () => {
    if (!customerId) return;

    try {
      setRefreshing(true);
      setError("");
      setNotice("");
      setRequests(await fetchCustomerRequests(customerId));
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh your appointments."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const removeCompletedRequest = async (request: ServiceRequest) => {
    if (!customerId || request.status !== "completed" || removingRequestId) return;

    const confirmed = window.confirm(
      "Remove this completed appointment from My Appointments? Its Garage service-history record will be kept."
    );
    if (!confirmed) return;

    try {
      setRemovingRequestId(request.id);
      setError("");
      setNotice("");
      const params = new URLSearchParams({
        actor_id: customerId,
        view: "customer",
      });
      const response = await fetch(
        `${apiUrl}/api/service-requests/${encodeURIComponent(request.id)}?${params.toString()}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Failed to remove completed appointment.");
      }

      setRequests((previous) => previous.filter((item) => item.id !== request.id));
      setNotice("Completed appointment removed. The service record remains in your Garage.");
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove completed appointment."
      );
    } finally {
      setRemovingRequestId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            My Appointments
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Track your service requests.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            See which requests are waiting for a mechanic, which appointments are
            confirmed, completed, or declined.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshRequests()}
          disabled={!customerId || loading || refreshing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending"
          value={counts.pending}
          icon={Clock}
          helper="Waiting for shop response"
          tone="amber"
        />
        <StatCard
          title="Accepted"
          value={counts.accepted}
          icon={CheckCircle2}
          helper="Confirmed appointments"
          tone="green"
        />
        <StatCard
          title="Declined"
          value={counts.declined}
          icon={XCircle}
          helper="Requests shops could not take"
          tone="slate"
        />
        <StatCard
          title="Completed"
          value={counts.completed}
          icon={ClipboardCheck}
          helper="Finished service appointments"
          tone="blue"
        />
      </section>

      {(error || notice) && (
        <div className="mt-6 space-y-3">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}
        </div>
      )}

      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Service Requests
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your latest request status comes directly from the mechanic.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveFilter(filter.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[#001F3F] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      active
                        ? "bg-white/15 text-white"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    {counts[filter.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">
              <Loader2 size={20} className="mr-3 animate-spin" />
              Loading appointments...
            </div>
          ) : visibleRequests.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            <div className="space-y-4">
              {visibleRequests.map((request) => (
                <AppointmentCard
                  key={request.id}
                  request={request}
                  removing={removingRequestId === request.id}
                  removeDisabled={Boolean(removingRequestId)}
                  onRemove={() => void removeCompletedRequest(request)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AppointmentCard({
  request,
  removing,
  removeDisabled,
  onRemove,
}: {
  request: ServiceRequest;
  removing: boolean;
  removeDisabled: boolean;
  onRemove: () => void;
}) {
  const status = statusStyles(request.status);
  const StatusIcon = status.icon;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Store size={20} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-950">
                  {request.shop_name || "MotorMate Mechanic"}
                </h3>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status.className}`}
                >
                  <StatusIcon size={13} />
                  {status.label}
                </span>
              </div>

              <p className="mt-1 text-sm font-semibold text-[#001F3F]">
                {request.service_requested}
              </p>

              {request.shop_address && (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  {request.shop_address}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoTile
              icon={CalendarDays}
              label="Appointment"
              value={formatDate(request.appointment_date)}
            />
            <InfoTile
              icon={Clock}
              label="Time"
              value={`${formatTime(request.appointment_start_time)} – ${formatTime(
                request.appointment_end_time
              )}`}
            />
            <InfoTile
              icon={Car}
              label="Vehicle"
              value={formatVehicle(request.vehicle_summary)}
            />
            <InfoTile
              icon={Gauge}
              label="Mileage"
              value={mileageLabel(request.vehicle_summary)}
            />
          </div>

          {request.problem_description?.trim() && (
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Your Description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {request.problem_description}
              </p>
            </div>
          )}

          {request.status === "completed" && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                <FileText size={14} />
                Completed Service Details
              </div>
              {request.completed_cost !== undefined && (
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <DollarSign size={14} />
                  <span className="font-semibold">Final price:</span>
                  {request.completed_cost.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })}
                </p>
              )}
              {request.completion_notes?.trim() && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  <span className="font-semibold">Mechanic notes:</span>{" "}
                  {request.completion_notes}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                This completed service is also saved in this vehicle&apos;s Garage service history.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Status:</span>{" "}
            {status.helper}
            {request.status_reason ? ` — ${request.status_reason}` : ""}
          </div>
        </div>

        <div className="flex shrink-0 flex-row gap-2 xl:flex-col">
          {request.mechanic_id && (
            <Link
              href={`/mechanics/${encodeURIComponent(request.mechanic_id)}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#001F3F] transition hover:border-[#001F3F] hover:bg-blue-50"
            >
              View Shop
              <ArrowRight size={15} />
            </Link>
          )}

          {request.status === "completed" && (
            <button
              type="button"
              onClick={onRemove}
              disabled={removeDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {removing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-5 text-slate-800">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ filter }: { filter: RequestFilter }) {
  const copy: Record<RequestFilter, { title: string; body: string }> = {
    all: {
      title: "No service requests yet",
      body: "Requests you submit to mechanics will appear here.",
    },
    pending: {
      title: "No pending requests",
      body: "You do not have any requests waiting for a mechanic response.",
    },
    accepted: {
      title: "No accepted appointments",
      body: "Appointments confirmed by mechanics will appear here.",
    },
    declined: {
      title: "No declined requests",
      body: "Requests a shop could not accept will appear here for reference.",
    },
    completed: {
      title: "No completed services",
      body: "Finished appointments will appear here after the mechanic completes them.",
    },
  };

  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-[#001F3F] shadow-sm ring-1 ring-slate-200">
        <CalendarDays size={25} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">
        {copy[filter].title}
      </h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        {copy[filter].body}
      </p>
      {filter === "all" && (
        <Link
          href="/mechanics"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]"
        >
          Find Mechanics
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
