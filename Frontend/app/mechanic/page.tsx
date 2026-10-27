"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  CalendarDays,
  Car,
  ClipboardList,
  Clock,
  DollarSign,
  Eye,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  X,
} from "lucide-react";

import StatCard from "@/components/StatCard";
import { auth } from "@/lib/firebase";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type OperatingHours = Record<string, string>;
type RequestStatus = "pending" | "accepted" | "declined";

type MechanicProfileResponse = {
  shop_name?: string;
  address?: string;
  phone?: string;
  services_offered?: string[];
  price_per_hour?: number;
  operating_hours?: OperatingHours;
};

type VehicleSummary = {
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
};

type ServiceRequest = {
  id: string;
  customer_name: string;
  mechanic_id: string;
  vehicle_summary?: VehicleSummary;
  appointment_date: string;
  appointment_start_time: string;
  appointment_end_time: string;
  service_requested: string;
  status: RequestStatus;
};

type RequestsResponse = {
  results?: ServiceRequest[];
  detail?: string;
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

async function fetchPendingRequests(mechanicId: string) {
  const response = await fetch(
    `${apiUrl}/api/service-requests/mechanic/${encodeURIComponent(
      mechanicId
    )}?status=pending`
  );
  const data = (await response.json().catch(() => ({}))) as RequestsResponse;

  if (!response.ok) {
    throw new Error(data.detail || "Failed to load repair requests.");
  }

  return Array.isArray(data.results) ? data.results : [];
}

function formatGroupedHours(hoursObj?: OperatingHours) {
  if (!hoursObj || !DAYS.some((day) => hoursObj[day]?.trim())) {
    return <span className="text-slate-500">Hours not set yet</span>;
  }

  const groups: { start: string; end: string; time: string }[] = [];

  for (const day of DAYS) {
    const time = hoursObj[day]?.trim() || "Closed";
    const last = groups[groups.length - 1];

    if (last && last.time === time) {
      last.end = day;
    } else {
      groups.push({ start: day, end: day, time });
    }
  }

  return (
    <div className="flex w-full min-w-50 flex-col gap-1.5 py-1">
      {groups.map((group) => (
        <div key={group.start} className="flex justify-between text-sm">
          <span className="font-semibold text-slate-700">
            {group.start === group.end
              ? DAY_LABELS[group.start]
              : `${DAY_LABELS[group.start]} - ${DAY_LABELS[group.end]}`}
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
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
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

export default function MechanicPage() {
  const [profile, setProfile] = useState<MechanicProfileResponse | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const [pendingRequests, setPendingRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestAction, setRequestAction] = useState<{
    requestId: string;
    status: "accepted" | "declined";
  } | null>(null);
  const [requestError, setRequestError] = useState("");
  const [requestNotice, setRequestNotice] = useState("");
  const [showServicesModal, setShowServicesModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setMechanicId("");
          setProfile(null);
          setHasProfile(false);
          setPendingRequests([]);
          setLoading(false);
        }
        return;
      }

      const currentMechanicId = user.uid;

      if (!cancelled) {
        setMechanicId(currentMechanicId);
        setLoading(true);
        setRequestError("");
      }

      const loadProfile = async () => {
        const response = await fetch(
          `${apiUrl}/api/mechanics/${encodeURIComponent(currentMechanicId)}`
        );

        if (response.status === 404) {
          if (!cancelled) {
            setProfile(null);
            setHasProfile(false);
          }
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load shop profile.");
        }

        const result = await response.json();
        if (!cancelled) {
          setProfile(result.profile || {});
          setHasProfile(true);
        }
      };

      const loadRequests = async () => {
        try {
          const nextRequests = await fetchPendingRequests(currentMechanicId);
          if (!cancelled) setPendingRequests(nextRequests);
        } catch (error) {
          if (!cancelled) {
            setPendingRequests([]);
            setRequestError(
              error instanceof Error
                ? error.message
                : "Failed to load repair requests."
            );
          }
        }
      };

      try {
        await Promise.all([loadProfile(), loadRequests()]);
      } catch (error) {
        console.error("Failed to load mechanic dashboard:", error);
        if (!cancelled) {
          setProfile(null);
          setHasProfile(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleRequestStatus = async (
    requestId: string,
    status: "accepted" | "declined"
  ) => {
    if (!mechanicId || requestAction) return;

    try {
      setRequestAction({ requestId, status });
      setRequestError("");
      setRequestNotice("");

      const response = await fetch(
        `${apiUrl}/api/service-requests/${encodeURIComponent(requestId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mechanic_id: mechanicId,
            status,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Failed to update repair request.");
      }

      const nextRequests = await fetchPendingRequests(mechanicId);
      setPendingRequests(nextRequests);
      setRequestNotice(
        status === "accepted"
          ? "Appointment accepted and reserved."
          : "Repair request declined."
      );
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Failed to update repair request."
      );
    } finally {
      setRequestAction(null);
    }
  };

  const shopName = profile?.shop_name || "Your Shop";
  const servicesCount = profile?.services_offered?.length ?? 0;
  const laborRate =
    profile?.price_per_hour !== undefined && profile?.price_per_hour !== null
      ? `$${profile.price_per_hour}/hr`
      : "Not set";
  const acceptingRequests =
    hasProfile &&
    Object.values(profile?.operating_hours || {}).some((hours) => hours?.trim());
  const featuredRequest = pendingRequests[0] || null;

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Welcome{!loading && hasProfile ? `, ${shopName}` : ""}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Here&apos;s what&apos;s happening at your shop.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-3 self-start rounded-xl border px-4 py-3 shadow-sm lg:self-auto ${
            acceptingRequests
              ? "border-emerald-100 bg-emerald-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              acceptingRequests ? "bg-emerald-600" : "bg-slate-400"
            }`}
          />
          <p
            className={`text-sm font-semibold ${
              acceptingRequests ? "text-emerald-700" : "text-slate-600"
            }`}
          >
            {acceptingRequests ? "Accepting Requests" : "Requests Paused"}
          </p>
        </div>
      </section>

      {!loading && !hasProfile && (
        <section className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            You haven&apos;t set up your shop profile yet. Customers won&apos;t
            be able to find you until you do.
          </p>

          <Link
            href="/mechanic/shop"
            className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]"
          >
            <Pencil size={14} />
            Create Shop Profile
          </Link>
        </section>
      )}

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Open Requests"
          value={loading ? "—" : pendingRequests.length}
          icon={ClipboardList}
          helper={
            loading
              ? "Loading requests"
              : pendingRequests.length === 0
                ? "Nothing waiting right now"
                : `${pendingRequests.length} waiting for a response`
          }
          tone={pendingRequests.length > 0 ? "amber" : "green"}
        />

        <StatCard
          title="Services Offered"
          value={loading ? "—" : servicesCount}
          icon={Wrench}
          helper="Active service types"
          tone="blue"
        />

        <StatCard
          title="Labor Rate"
          value={loading ? "—" : laborRate}
          icon={DollarSign}
          helper="Your standard rate"
          tone="slate"
        />
      </section>

      {(requestError || requestNotice) && (
        <section className="mt-6 space-y-3">
          {requestError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {requestError}
            </div>
          )}
          {requestNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {requestNotice}
            </div>
          )}
        </section>
      )}

      <section className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Repair Requests
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Incoming requests waiting for your response.
              </p>
            </div>

            <Link
              href="/mechanic/requests"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#001F3F]"
            >
              View all
            </Link>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Loading repair requests...
              </div>
            ) : featuredRequest ? (
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                      <Wrench size={18} />
                    </div>

                    <div>
                      <p className="font-semibold text-slate-950">
                        {featuredRequest.service_requested}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                        <Car size={14} />
                        {formatVehicle(featuredRequest.vehicle_summary)}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-400">
                        Requested by {featuredRequest.customer_name}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Pending
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    <span className="flex items-center gap-2 font-semibold text-slate-800">
                      <CalendarDays size={14} />
                      {formatDate(featuredRequest.appointment_date)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    <span className="flex items-center gap-2 font-semibold text-slate-800">
                      <Clock size={14} />
                      {formatTime(featuredRequest.appointment_start_time)} –{" "}
                      {formatTime(featuredRequest.appointment_end_time)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={Boolean(requestAction)}
                    onClick={() =>
                      void handleRequestStatus(featuredRequest.id, "accepted")
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {requestAction?.requestId === featuredRequest.id &&
                    requestAction.status === "accepted" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ThumbsUp size={15} />
                    )}
                    Accept
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(requestAction)}
                    onClick={() =>
                      void handleRequestStatus(featuredRequest.id, "declined")
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {requestAction?.requestId === featuredRequest.id &&
                    requestAction.status === "declined" ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <ThumbsDown size={15} />
                    )}
                    Decline
                  </button>

                  <Link
                    href="/mechanic/requests"
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                  >
                    <Eye size={15} />
                    View Details
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center">
                <ClipboardList size={28} className="text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  No pending repair requests
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  New customer requests will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Shop Profile
              </p>
              <p className="mt-1 text-xs text-slate-500">
                How customers see your business.
              </p>
            </div>

            <Link
              href="/mechanic/shop"
              className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
            >
              <Pencil size={14} />
              Edit
            </Link>
          </div>

          <div className="space-y-4 p-6">
            {loading ? (
              <p className="text-sm text-slate-400">Loading shop profile...</p>
            ) : (
              <>
                <ProfileRow
                  icon={MapPin}
                  label={profile?.address || "Address not set yet"}
                />
                <ProfileRow
                  icon={Clock}
                  label={formatGroupedHours(profile?.operating_hours)}
                />
                <ProfileRow
                  icon={Wrench}
                  label={
                    !profile?.services_offered?.length ? (
                      <span className="text-slate-500">
                        No services listed yet
                      </span>
                    ) : (
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="line-clamp-1 pr-2">
                          {profile.services_offered.slice(0, 3).join(", ")}
                          {profile.services_offered.length > 3 ? "..." : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowServicesModal(true)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-50 text-[#001F3F] transition-colors hover:bg-[#001F3F] hover:text-white"
                          title="View all services"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )
                  }
                />
                <ProfileRow icon={DollarSign} label={`${laborRate} labor rate`} />
              </>
            )}
          </div>
        </div>
      </section>

      {showServicesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-[#001F3F]">
                  Services Offered
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">{shopName}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowServicesModal(false)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close services"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
              <ul className="space-y-2">
                {profile?.services_offered?.map((service) => (
                  <li
                    key={service}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#001F3F] shadow-sm">
                      <Wrench size={12} />
                    </div>
                    {service}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#001F3F] shadow-sm">
        <Icon size={16} />
      </div>
      <div className="mt-0.5 w-full text-sm font-medium text-slate-700">
        {label}
      </div>
    </div>
  );
}
