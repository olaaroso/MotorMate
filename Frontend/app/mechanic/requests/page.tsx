"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  CalendarDays,
  Car,
  CheckCircle2,
  ClipboardList,
  Clock,
  ClipboardCheck,
  Gauge,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  Wrench,
  X,
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
  vin?: string | null;
  current_mileage?: string | number | null;
};

type ServiceRequest = {
  id: string;
  customer_id: string;
  customer_name: string;
  mechanic_id: string;
  shop_name?: string;
  shop_address?: string;
  vehicle_id: string;
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
};

type RequestsResponse = {
  count?: number;
  results?: ServiceRequest[];
};

const FILTERS: Array<{ value: RequestFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
];

async function fetchMechanicRequests(
  mechanicId: string
): Promise<ServiceRequest[]> {
  const response = await fetch(
    `${apiUrl}/api/service-requests/mechanic/${encodeURIComponent(mechanicId)}`
  );
  const data = (await response.json().catch(() => ({}))) as RequestsResponse & {
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(data.detail || "Failed to load repair requests.");
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

  const name = [summary.year, summary.make, summary.model]
    .filter(Boolean)
    .join(" ");

  return name || "Vehicle details unavailable";
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
      className: "bg-blue-50 text-blue-700 ring-blue-100",
      icon: ClipboardCheck,
    };
  }

  if (status === "accepted") {
    return {
      label: "Accepted",
      className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      icon: CheckCircle2,
    };
  }

  if (status === "declined") {
    return {
      label: "Declined",
      className: "bg-red-50 text-red-700 ring-red-100",
      icon: XCircle,
    };
  }

  return {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
    icon: Clock,
  };
}

export default function MechanicRequestsPage() {
  const [mechanicId, setMechanicId] = useState("");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [activeFilter, setActiveFilter] = useState<RequestFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingAction, setUpdatingAction] = useState<{
    requestId: string;
    status: "accepted" | "declined" | "completed";
  } | null>(null);
  const [completionRequest, setCompletionRequest] = useState<ServiceRequest | null>(null);
  const [completionMileage, setCompletionMileage] = useState("");
  const [completionError, setCompletionError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (!cancelled) {
          setMechanicId("");
          setRequests([]);
          setError("Sign in as a mechanic to view repair requests.");
          setLoading(false);
        }
        return;
      }

      const currentMechanicId = user.uid;

      if (!cancelled) {
        setMechanicId(currentMechanicId);
        setError("");
        setLoading(true);
      }

      void fetchMechanicRequests(currentMechanicId)
        .then((nextRequests) => {
          if (!cancelled) {
            setRequests(nextRequests);
          }
        })
        .catch((loadError) => {
          if (!cancelled) {
            setRequests([]);
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Failed to load repair requests."
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
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
    if (activeFilter === "all") return requests;
    return requests.filter((request) => request.status === activeFilter);
  }, [activeFilter, requests]);

  const refreshRequests = async () => {
    if (!mechanicId) return;

    try {
      setRefreshing(true);
      setError("");
      setNotice("");

      const nextRequests = await fetchMechanicRequests(mechanicId);
      setRequests(nextRequests);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Failed to refresh repair requests."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const handleStatusChange = async (
    requestId: string,
    status: "accepted" | "declined" | "completed",
    completedMileage?: number
  ) => {
    if (!mechanicId || updatingAction) return;

    try {
      setUpdatingAction({ requestId, status });
      setError("");
      setNotice("");

      const response = await fetch(
        `${apiUrl}/api/service-requests/${encodeURIComponent(requestId)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mechanic_id: mechanicId,
            status,
            ...(completedMileage !== undefined
              ? { completed_mileage: completedMileage }
              : {}),
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update repair request.");
      }

      const nextRequests = await fetchMechanicRequests(mechanicId);
      setRequests(nextRequests);
      setNotice(
        status === "accepted"
          ? "Appointment accepted. That time is now reserved."
          : status === "completed"
            ? completedMileage !== undefined
              ? `Service completed. Vehicle mileage updated to ${completedMileage.toLocaleString()} mi.`
              : "Service marked completed."
            : "Repair request declined."
      );

      if (status === "completed") {
        setCompletionRequest(null);
        setCompletionMileage("");
        setCompletionError("");
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update repair request."
      );
    } finally {
      setUpdatingAction(null);
    }
  };

  const openCompletion = (request: ServiceRequest) => {
    setCompletionRequest(request);
    setCompletionMileage("");
    setCompletionError("");
  };

  const closeCompletion = () => {
    if (updatingAction?.status === "completed") return;
    setCompletionRequest(null);
    setCompletionMileage("");
    setCompletionError("");
  };

  const completeRequest = async () => {
    if (!completionRequest) return;

    const trimmedMileage = completionMileage.trim();
    let finalMileage: number | undefined;

    if (trimmedMileage) {
      finalMileage = Number(trimmedMileage);
      if (!Number.isInteger(finalMileage) || finalMileage < 0) {
        setCompletionError("Enter a valid whole-number mileage or leave it blank.");
        return;
      }

      const currentMileage = Number(completionRequest.vehicle_summary?.current_mileage);
      if (Number.isFinite(currentMileage) && finalMileage < currentMileage) {
        setCompletionError(
          `Mileage cannot be lower than the current ${currentMileage.toLocaleString()} mi.`
        );
        return;
      }
    }

    setCompletionError("");
    await handleStatusChange(completionRequest.id, "completed", finalMileage);
  };

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Repair Requests
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Manage appointment requests.
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Review customer repair requests and decide which appointments your
            shop can take.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshRequests()}
          disabled={!mechanicId || loading || refreshing || Boolean(updatingAction)}
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
          helper="Waiting for your response"
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
          helper="Requests you could not take"
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
        <section className="mt-6 space-y-3">
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
        </section>
      )}

      <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Appointment Requests
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pending requests can share a time until one is accepted.
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
              Loading repair requests...
            </div>
          ) : visibleRequests.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            <div className="space-y-4">
              {visibleRequests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  updatingStatus={
                    updatingAction?.requestId === request.id
                      ? updatingAction.status
                      : null
                  }
                  actionsDisabled={Boolean(updatingAction)}
                  onAccept={() =>
                    void handleStatusChange(request.id, "accepted")
                  }
                  onDecline={() =>
                    void handleStatusChange(request.id, "declined")
                  }
                  onComplete={() => openCompletion(request)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {completionRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
                  Complete Service
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Mark appointment completed
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  You can optionally enter the vehicle&apos;s final odometer reading.
                  If supplied, MotorMate updates the owner&apos;s Garage mileage too.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCompletion}
                disabled={updatingAction?.status === "completed"}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close completion dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {completionRequest.service_requested}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {formatVehicle(completionRequest.vehicle_summary)} · Current recorded mileage: {mileageLabel(completionRequest.vehicle_summary)}
              </p>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Updated mileage <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="relative mt-2">
              <Gauge
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={completionMileage}
                onChange={(event) => {
                  setCompletionMileage(event.target.value);
                  setCompletionError("");
                }}
                placeholder="Leave blank to keep current mileage"
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              />
            </div>

            {completionError && (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {completionError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={closeCompletion}
                disabled={updatingAction?.status === "completed"}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void completeRequest()}
                disabled={Boolean(updatingAction)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:opacity-50"
              >
                {updatingAction?.status === "completed" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ClipboardCheck size={15} />
                )}
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  updatingStatus,
  actionsDisabled,
  onAccept,
  onDecline,
  onComplete,
}: {
  request: ServiceRequest;
  updatingStatus: "accepted" | "declined" | "completed" | null;
  actionsDisabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onComplete: () => void;
}) {
  const status = statusStyles(request.status);
  const StatusIcon = status.icon;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Wrench size={20} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-950">
                  {request.service_requested}
                </h3>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status.className}`}
                >
                  <StatusIcon size={13} />
                  {status.label}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Requested by {request.customer_name || "MotorMate customer"}
              </p>
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
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <UserRound size={14} />
                Customer Description
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {request.problem_description}
              </p>
            </div>
          )}

          {request.status_reason && (
            <p className="mt-3 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">Reason:</span>{" "}
              {request.status_reason}
            </p>
          )}
        </div>

        {request.status === "pending" && (
          <div className="flex shrink-0 flex-row gap-2 xl:flex-col">
            <button
              type="button"
              onClick={onAccept}
              disabled={actionsDisabled}
              className="inline-flex min-w-28 flex-1 items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updatingStatus === "accepted" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ThumbsUp size={15} />
              )}
              Accept
            </button>

            <button
              type="button"
              onClick={onDecline}
              disabled={actionsDisabled}
              className="inline-flex min-w-28 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updatingStatus === "declined" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ThumbsDown size={15} />
              )}
              Decline
            </button>
          </div>
        )}

        {request.status === "accepted" && (
          <div className="flex shrink-0 xl:flex-col">
            <button
              type="button"
              onClick={onComplete}
              disabled={actionsDisabled}
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardCheck size={15} />
              Mark Completed
            </button>
          </div>
        )}
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
      title: "No repair requests yet",
      body: "Customer appointment requests will appear here after they are submitted.",
    },
    pending: {
      title: "No pending requests",
      body: "There are no customer requests waiting for your response right now.",
    },
    accepted: {
      title: "No accepted appointments",
      body: "Appointments you accept will appear here.",
    },
    declined: {
      title: "No declined requests",
      body: "Requests you decline will appear here for reference.",
    },
    completed: {
      title: "No completed services",
      body: "Finished appointments will appear here after you mark them completed.",
    },
  };

  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-[#001F3F] shadow-sm ring-1 ring-slate-200">
        <ClipboardList size={25} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">
        {copy[filter].title}
      </h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        {copy[filter].body}
      </p>
    </div>
  );
}
