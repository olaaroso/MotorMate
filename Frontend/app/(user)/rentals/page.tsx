"use client";

import {
  CalendarDays,
  Clock,
  Package,
  Search,
} from "lucide-react";
import Link from "next/link";

export default function MyRentalsPage() {
  return (
    <div className="mx-auto max-w-7xl p-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          ToolDrop
        </p>

        <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">
          My Rentals
        </h1>

        <p className="mt-2 max-w-2xl text-gray-500">
          View tools you are currently renting,
          upcoming rentals, and your rental history.
        </p>
      </section>

      {/* SUMMARY */}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
            <Package size={20} />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Active Rentals
          </p>

          <p className="mt-1 text-2xl font-bold text-[#001F3F]">
            0
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
            <CalendarDays size={20} />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Upcoming
          </p>

          <p className="mt-1 text-2xl font-bold text-[#001F3F]">
            0
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
            <Clock size={20} />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Past Rentals
          </p>

          <p className="mt-1 text-2xl font-bold text-[#001F3F]">
            0
          </p>
        </div>
      </div>

      {/* EMPTY STATE */}

      <section className="mt-8 rounded-2xl border bg-white p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
          <Package size={27} />
        </div>

        <h2 className="mt-5 text-xl font-bold text-[#001F3F]">
          No active rentals
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
          When you rent a tool from another
          MotorMate user, you'll be able to manage
          that rental here.
        </p>

        <Link
          href="/tooldrop"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 font-semibold text-white transition hover:bg-[#003366]"
        >
          <Search size={17} />
          Browse ToolDrop
        </Link>
      </section>
    </div>
  );
}