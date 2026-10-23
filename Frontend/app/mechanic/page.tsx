"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Clock,
  DollarSign,
  Eye,
  MapPin,
  Pencil,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  Plus,
  X,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import StatCard from "@/components/StatCard";

const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type OperatingHours = Record<string, string>;

type MechanicProfileResponse = {
  shop_name?: string;
  address?: string;
  phone?: string;
  services_offered?: string[];
  price_per_hour?: number;
  operating_hours?: OperatingHours;
};

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_ABBREV: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function formatGroupedHours(hoursObj?: OperatingHours) {
  if (!hoursObj || Object.keys(hoursObj).length === 0) {
    return <span className="text-slate-500">Hours not set yet</span>;
  }

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const labels: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
  };

  const hasAnyHours = days.some(day => hoursObj[day]?.trim());
  if (!hasAnyHours) {
    return <span className="text-slate-500">Hours not set yet</span>;
  }

  const groups: { start: string; end: string; time: string }[] = [];
  let currentGroup: { start: string; end: string; time: string } | null = null;

  for (const day of days) {
    const time = hoursObj[day]?.trim() || "Closed";

    if (!currentGroup) {
      currentGroup = { start: day, end: day, time };
    } else if (currentGroup.time === time) {
      currentGroup.end = day;
    } else {
      groups.push(currentGroup);
      currentGroup = { start: day, end: day, time };
    }
  }

  if (currentGroup) groups.push(currentGroup);

  return (
      <div className="flex w-full min-w-[200px] flex-col gap-1.5 py-1">
        {groups.map((g, i) => (
            <div key={i} className="flex justify-between text-sm">
          <span className="font-semibold text-slate-700">
            {g.start === g.end ? labels[g.start] : `${labels[g.start]} - ${labels[g.end]}`}
          </span>
              <span className={g.time === "Closed" ? "italic text-slate-400" : "text-slate-500"}>
            {g.time}
          </span>
            </div>
        ))}
      </div>
  );
}

export default function MechanicPage() {
  const [profile, setProfile] = useState<MechanicProfileResponse | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showServicesModal, setShowServicesModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/api/mechanics/${user.uid}`);

        if (response.status === 404) {
          setHasProfile(false);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load shop profile.");
        }

        const result = await response.json();
        setProfile(result.profile || {});
        setHasProfile(true);
      } catch (err) {
        console.error("Failed to load mechanic dashboard:", err);
        setHasProfile(false);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const shopName = profile?.shop_name || "Your Shop";
  const servicesCount = profile?.services_offered?.length ?? 0;
  const laborRate =
    profile?.price_per_hour !== undefined && profile?.price_per_hour !== null
      ? `$${profile.price_per_hour}/hr`
      : "Not set";

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      {/* WELCOME + STATUS */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Welcome{!loading && hasProfile ? `, ${shopName}` : ""}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            Here&apos;s what&apos;s happening at your shop.
          </p>
        </div>

        <div className="inline-flex items-center gap-3 self-start rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 shadow-sm lg:self-auto">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
          </span>

          <p className="text-sm font-semibold text-emerald-700">
            Accepting Requests
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

      {/* STAT CARDS */}
      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Open Requests"
          value={0}
          icon={ClipboardList}
          helper="Nothing waiting right now"
          tone="green"
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

      {/* BOTTOM SECTION */}
      <section className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* REPAIR REQUESTS */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Repair Requests
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Incoming requests from nearby customers.
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
            <div className="rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                    <Wrench size={18} />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-950">
                      Brake Inspection
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      2015 Honda Civic
                    </p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      Requested by J. Martinez
                    </p>
                  </div>
                </div>

                <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Pending
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003366]"
                >
                  <ThumbsUp size={15} />
                  Accept
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <ThumbsDown size={15} />
                  Decline
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                >
                  <Eye size={15} />
                  View Details
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SHOP PROFILE */}
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
                          <span className="text-slate-500">No services listed yet</span>
                      ) : (
                          <div className="flex w-full items-center justify-between gap-2">
                        <span className="line-clamp-1 pr-2">
                          {profile.services_offered.slice(0, 3).join(", ")}
                          {profile.services_offered.length > 3 ? "..." : ""}
                        </span>
                            <button
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
                  <h3 className="text-xl font-bold text-[#001F3F]">Services Offered</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{shopName}</p>
                </div>
                <button
                    onClick={() => setShowServicesModal(false)}
                    className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
                <ul className="space-y-2">
                  {profile?.services_offered?.map((service, idx) => (
                      <li key={idx} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
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
        <div className="mt-0.5 text-sm font-medium text-slate-700 w-full">{label}</div>
      </div>
  );
}
