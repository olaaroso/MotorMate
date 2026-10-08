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
} from "lucide-react";
import StatCard from "@/components/StatCard";

export default function MechanicPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      {/* WELCOME + STATUS */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Welcome, Jason&apos;s Auto Repair
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
          value={6}
          icon={Wrench}
          helper="Active service types"
          tone="blue"
        />

        <StatCard
          title="Labor Rate"
          value="$110/hr"
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
            <ProfileRow icon={MapPin} label="123 Main St, Farmingdale" />
            <ProfileRow icon={Clock} label="Mon-Sat, 8am-5pm" />
            <ProfileRow icon={Wrench} label="Brakes, oil, tires, diagnostics" />
            <ProfileRow icon={DollarSign} label="$110/hr labor rate" />
          </div>
        </div>
      </section>
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#001F3F] shadow-sm">
        <Icon size={16} />
      </div>
      <p className="text-sm font-medium text-slate-700">{label}</p>
    </div>
  );
}