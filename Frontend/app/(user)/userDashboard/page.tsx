"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Car,
  CircleDollarSign,
  Gauge,
  Hammer,
  Loader2,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { createCarImage } from "@/lib/carImage";
import StatCard from "@/components/StatCard";

type DashboardVehicle = {
  id?: string;
  vin?: string | null;
  make: string;
  model: string;
  year: string;
  mileage: number;
  maintenance: string;
  maintenanceDistance: string;
  estimatedCost: number | null;
};

type PredictionItem = {
  part: string;
  probability: number;
  estimated_cost: number;
};

type ApiVehicle = {
  _id?: string;
  id?: string;
  vin?: string | null;
  make?: string;
  model?: string;
  year?: string | number;
  current_mileage?: number | string;
  driving_habits?: string;
};

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getLikelihoodPercent(value: string) {
  const parsed = Number(value.match(/\d+/)?.[0] ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<DashboardVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("Mate");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setVehicles([]);
        setLoading(false);
        return;
      }

      setDisplayName(
        user.displayName?.trim().split(/\s+/)[0] ||
          user.email?.split("@")[0] ||
          "Mate"
      );

      try {
        setLoading(true);

        const response = await fetch(
          `${apiUrl}/api/vin/vehicles/${user.uid}`
        );

        if (!response.ok) {
          throw new Error("Failed to load vehicles.");
        }

        const result = await response.json();

        const loadedVehicles: DashboardVehicle[] = await Promise.all(
          (result.vehicles ?? []).map(async (car: ApiVehicle) => {
            const make = titleCase(String(car.make || ""));
            const model = titleCase(String(car.model || ""));
            const year = String(car.year || "N/A");
            const mileage = Number(car.current_mileage || 0);

            let maintenance = "Inspection Required";
            let maintenanceDistance = "Prediction unavailable";
            let estimatedCost: number | null = null;

            if (car.vin) {
              try {
                const predictionResponse = await fetch(
                  `${apiUrl}/api/predict/`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      vin: car.vin,
                      mileage,
                    }),
                  }
                );

                if (predictionResponse.ok) {
                  const predictionData =
                    await predictionResponse.json();

                  const prediction: PredictionItem | undefined =
                    predictionData.upcoming_repairs?.[0];

                  if (prediction) {
                    maintenance = prediction.part;
                    maintenanceDistance = `${Math.round(
                      prediction.probability * 100
                    )}% likelihood`;
                    estimatedCost = prediction.estimated_cost;
                  }
                }
              } catch (error) {
                console.warn(
                  "Dashboard prediction unavailable:",
                  error
                );
              }
            }

            return {
              id: car._id || car.id,
              vin: car.vin || null,
              make,
              model,
              year,
              mileage,
              maintenance,
              maintenanceDistance,
              estimatedCost,
            };
          })
        );

        setVehicles(loadedVehicles);
      } catch (error) {
        console.error("Failed to load dashboard:", error);
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const maintenanceAlerts = useMemo(
    () =>
      vehicles.filter(
        (vehicle) =>
          getLikelihoodPercent(vehicle.maintenanceDistance) >= 60
      ),
    [vehicles]
  );

  const estimatedRepairs = useMemo(
    () =>
      maintenanceAlerts.reduce(
        (sum, vehicle) => sum + (vehicle.estimatedCost ?? 0),
        0
      ),
    [maintenanceAlerts]
  );

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          

          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Welcome back, {displayName}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            See what needs attention, check your garage, and jump into
            the next step!
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/mechanics"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <MapPin size={17} />
            Find a Mechanic
          </Link>

          <Link
            href="/garage"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
          >
            <Car size={17} />
            Open Garage
          </Link>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Vehicles in Garage"
          value={loading ? "—" : vehicles.length}
          icon={Car}
          helper="Saved vehicles"
          tone="blue"
        />

        <StatCard
          title="Maintenance Alerts"
          value={loading ? "—" : maintenanceAlerts.length}
          icon={Wrench}
          helper={
            maintenanceAlerts.length
              ? "Needs attention"
              : "Nothing urgent"
          }
          tone={maintenanceAlerts.length ? "amber" : "green"}
        />

        <StatCard
          title="Estimated Repairs"
          value={
            loading
              ? "—"
              : estimatedRepairs > 0
              ? `$${estimatedRepairs.toLocaleString()}`
              : "$0"
          }
          icon={CircleDollarSign}
          helper="From current predictions"
          tone="slate"
        />
      </section>

      <section className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Your Garage
              </p>
              <p className="mt-1 text-xs text-slate-500">
                A quick view of your most recent vehicles.
              </p>
            </div>

            <Link
              href="/garage"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#001F3F]"
            >
              View Garage
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <Loader2 size={18} className="animate-spin" />
                  Loading your vehicles...
                </div>
              </div>
            ) : vehicles.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#001F3F] shadow-sm">
                  <Car size={22} />
                </div>
                <h3 className="mt-4 font-semibold text-slate-950">
                  Your garage is empty
                </h3>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
                  Add a vehicle to start tracking mileage and maintenance.
                </p>
                <Link
                  href="/garage"
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus size={16} />
                  Add your first vehicle
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {vehicles.slice(0, 2).map((vehicle) => (
                  <VehiclePreviewCard
                    key={
                      vehicle.id ||
                      `${vehicle.year}-${vehicle.make}-${vehicle.model}`
                    }
                    vehicle={vehicle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#001F3F]/6 text-[#001F3F]">
                <Gauge size={19} />
              </div>
              <div>
                <p className="font-semibold text-slate-950">
                  Quick Actions
                </p>
                <p className="text-xs text-slate-500">
                  Get where you need to go.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <QuickAction
                href="/mechanics"
                icon={MapPin}
                title="Find a mechanic"
                description="Compare local repair options"
              />
              <QuickAction
                href="/tooldrop"
                icon={Hammer}
                title="Browse ToolDrop"
                description="Find tools for your next DIY job"
              />
              <QuickAction
                href="/rentals"
                icon={Package}
                title="My rentals"
                description="Track current and past reservations"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-[#001F3F] p-6 text-white shadow-[0_14px_40px_rgba(0,31,63,0.18)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
              <ShieldCheck size={21} />
            </div>

            <h2 className="mt-5 text-lg font-semibold">
              Keep your vehicle history organized
            </h2>

            <p className="mt-2 text-sm leading-6 text-white/70">
              Maintenance records, mileage, and upcoming service can all
              live in one place as your MotorMate profile grows.
            </p>

            <Link
              href="/garage"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white"
            >
              Manage your garage
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Needs Attention
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Maintenance items surfaced from your saved vehicles.
              </p>
            </div>

            <Link
              href="/maintenance"
              className="text-sm font-semibold text-[#001F3F]"
            >
              View all
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
                Loading maintenance...
              </div>
            ) : maintenanceAlerts.length ? (
              maintenanceAlerts.slice(0, 3).map((vehicle) => {
                const likelihood = getLikelihoodPercent(
                  vehicle.maintenanceDistance
                );

                return (
                  <div
                    key={`maintenance-${vehicle.id}`}
                    className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                        <Wrench size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {vehicle.maintenance}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-sm font-semibold text-amber-700">
                        {likelihood}% likelihood
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {vehicle.estimatedCost !== null
                          ? `Estimated $${vehicle.estimatedCost}`
                          : "Cost unavailable"}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="font-medium text-emerald-900">
                  Nothing urgent right now
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  New maintenance predictions will appear here when available.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-[#001F3F]">
            <MapPin size={21} />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-950">
            Need professional help?
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Compare local mechanics, service options, and repair
            estimates when you would rather leave the work to a pro.
          </p>

          <Link
            href="/mechanics"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003366]"
          >
            Search Mechanics
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function VehiclePreviewCard({
  vehicle,
}: {
  vehicle: DashboardVehicle;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const likelihood = getLikelihoodPercent(vehicle.maintenanceDistance);

  const likelihoodClass =
    likelihood >= 75
      ? "bg-red-50 text-red-700"
      : likelihood >= 60
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-40 overflow-hidden bg-linear-to-br from-slate-100 to-slate-50">
        {!imageFailed ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={createCarImage(
                vehicle.make,
                vehicle.model,
                vehicle.year
              )}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
              onError={() => setImageFailed(true)}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Car size={42} />
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          {vehicle.year}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {vehicle.make} {vehicle.model}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {vehicle.mileage.toLocaleString()} miles
            </p>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Car size={17} />
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Next maintenance
          </p>

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-slate-800">
              {vehicle.maintenance}
            </p>

            {likelihood > 0 && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${likelihoodClass}`}
              >
                {likelihood}%
              </span>
            )}
          </div>
        </div>

        <Link
          href="/garage"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
        >
          View vehicle
          <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-slate-200 hover:bg-slate-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#001F3F] transition group-hover:bg-[#001F3F] group-hover:text-white">
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight
        size={16}
        className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
      />
    </Link>
  );
}
