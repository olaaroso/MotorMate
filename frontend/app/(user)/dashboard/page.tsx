import Link from "next/link";
import {
  Car,
  Wrench,
  Package,
  MapPin,
  ArrowRight,
} from "lucide-react";

import StatCard from "@/components/StatCard";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl p-8">

      {/* HEADER */}

      <section>
        <h1 className="text-3xl font-bold text-[#001F3F]">
          Welcome back, John
        </h1>

        <p className="mt-1 text-gray-500">
          Here&apos;s an overview of your vehicles and upcoming maintenance.
        </p>
      </section>


      {/* STAT CARDS */}

      <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">

        <StatCard
          title="Vehicles in Garage"
          value={2}
          icon={Car}
        />

        <StatCard
          title="Upcoming Maintenance"
          value={1}
          icon={Wrench}
        />

        <StatCard
          title="Active Rentals"
          value={0}
          icon={Package}
        />

      </section>


      {/* YOUR VEHICLES */}

      <section className="mt-8 rounded-xl border bg-white p-6">

        <div className="mb-5 flex items-center justify-between">

          <h2 className="text-xl font-bold">
            Your Vehicles
          </h2>

          <Link
            href="/garage"
            className="flex items-center gap-2 text-sm font-medium text-[#001F3F]"
          >
            View Garage
            <ArrowRight size={16} />
          </Link>

        </div>


        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

          {/* CIVIC */}

          <div className="rounded-xl border p-5">

            <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              Honda Civic Image
            </div>

            <h3 className="mt-4 text-xl font-bold">
              2019 Honda Civic
            </h3>

            <p className="text-gray-500">
              74,200 miles
            </p>

            <div className="mt-4 flex items-center justify-between border-t pt-4">

              <div className="flex items-center gap-3">

                <Wrench
                  size={20}
                  className="text-[#001F3F]"
                />

                <div>
                  <p className="text-sm font-medium">
                    Next Maintenance
                  </p>

                  <p className="text-sm text-gray-500">
                    Oil Change
                  </p>
                </div>

              </div>

              <span className="text-sm font-medium text-amber-600">
                ~1,200 miles
              </span>

            </div>

            <button className="mt-5 w-full rounded-lg bg-gray-100 py-2 font-medium hover:bg-gray-200">
              View Details
            </button>

          </div>


          {/* RAV4 */}

          <div className="rounded-xl border p-5">

            <div className="flex h-40 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              Toyota RAV4 Image
            </div>

            <h3 className="mt-4 text-xl font-bold">
              2022 Toyota RAV4
            </h3>

            <p className="text-gray-500">
              28,500 miles
            </p>

            <div className="mt-4 flex items-center justify-between border-t pt-4">

              <div className="flex items-center gap-3">

                <Wrench
                  size={20}
                  className="text-[#001F3F]"
                />

                <div>
                  <p className="text-sm font-medium">
                    Next Maintenance
                  </p>

                  <p className="text-sm text-gray-500">
                    Tire Rotation
                  </p>
                </div>

              </div>

              <span className="text-sm font-medium text-green-700">
                ~3,000 miles
              </span>

            </div>

            <button className="mt-5 w-full rounded-lg bg-gray-100 py-2 font-medium hover:bg-gray-200">
              View Details
            </button>

          </div>

        </div>

      </section>


      {/* MAINTENANCE + MECHANIC */}

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Maintenance */}

        <div className="rounded-xl border bg-white p-6 lg:col-span-2">

          <h2 className="text-xl font-bold">
            Upcoming Maintenance
          </h2>

          <div className="mt-5 space-y-3">

            <div className="flex items-center justify-between rounded-lg border p-4">

              <div>
                <p className="font-semibold">
                  2019 Honda Civic
                </p>

                <p className="text-sm text-gray-500">
                  Oil Change
                </p>
              </div>

              <span className="text-sm text-amber-600">
                ~1,200 miles
              </span>

            </div>


            <div className="flex items-center justify-between rounded-lg border p-4">

              <div>
                <p className="font-semibold">
                  2022 Toyota RAV4
                </p>

                <p className="text-sm text-gray-500">
                  Tire Rotation
                </p>
              </div>

              <span className="text-sm text-green-700">
                ~3,000 miles
              </span>

            </div>

          </div>

        </div>


        {/* Find mechanic */}

        <div className="rounded-xl border bg-white p-6">

          <h2 className="text-xl font-bold">
            Find a Mechanic
          </h2>

          <MapPin
            size={40}
            className="mt-6 text-[#001F3F]"
          />

          <p className="mt-4 text-sm text-gray-500">
            Compare local mechanics, read reviews, and get repair estimates.
          </p>

          <Link
            href="/mechanics"
            className="mt-6 block rounded-lg bg-[#001F3F] py-3 text-center font-medium text-white hover:bg-[#003366]"
          >
            Search Mechanics
          </Link>

        </div>

      </section>


      {/* RECENTLY VIEWED */}

      <section className="mt-8 rounded-xl border bg-white p-6">

        <h2 className="text-xl font-bold">
          Recently Viewed
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">

          {[
            "Brake Pad Set",
            "Floor Jack",
            "Engine Oil",
          ].map((item) => (
            <div
              key={item}
              className="rounded-lg border p-4"
            >

              <div className="mb-4 flex h-24 items-center justify-center rounded bg-gray-100 text-sm text-gray-400">
                Product Image
              </div>

              <p className="font-semibold">
                {item}
              </p>

              <p className="text-xs text-gray-500">
                ToolDrop
              </p>

              <button className="mt-3 w-full rounded bg-gray-100 py-2 text-sm hover:bg-gray-200">
                View
              </button>

            </div>
          ))}

        </div>

      </section>

    </div>
  );
}