"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Search,
  XCircle,
} from "lucide-react";

import { auth } from "@/lib/firebase";

type RentalRequest = {
  id: string;
  listing_id: string;
  owner_id: string;
  renter_id: string;
  renter_name: string;
  seller_name: string;
  tool_name: string;
  photo_urls?: string[];
  location?: string;
  start_date: string;
  end_date: string;
  daily_rate: number;
  deposit: number;
  rental_days: number;
  rental_price: number;
  total_with_deposit: number;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "active"
    | "completed"
    | "cancelled";
  created_at?: string;
  approved_at?: string;
  rejected_at?: string;
  cancelled_at?: string;
};

function getTodayString() {
  const now = new Date();

  const timezoneOffset =
    now.getTimezoneOffset() * 60 * 1000;

  return new Date(
    now.getTime() - timezoneOffset
  )
    .toISOString()
    .split("T")[0];
}

function formatDate(dateString: string) {
  if (!dateString) return "";

  const [year, month, day] =
    dateString.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MyRentalsPage() {
  const [rentals, setRentals] =
    useState<RentalRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMsg, setErrorMsg] =
    useState("");

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  const today =
    getTodayString();

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            setRentals([]);
            setLoading(false);
            return;
          }

          try {
            setLoading(true);
            setErrorMsg("");

            const response =
              await fetch(
                `${apiUrl}/api/diy/rental-requests/renter/${user.uid}`
              );

            const data =
              await response
                .json()
                .catch(() => ({}));

            if (!response.ok) {
              throw new Error(
                data.detail ||
                  "Failed to load your rentals."
              );
            }

            setRentals(
              data.results || []
            );
          } catch (error) {
            console.error(
              "Failed to load rentals:",
              error
            );

            setErrorMsg(
              error instanceof Error
                ? error.message
                : "Failed to load your rentals."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [apiUrl]);

  const pendingRequests =
    useMemo(
      () =>
        rentals.filter(
          (rental) =>
            rental.status ===
            "pending"
        ),
      [rentals]
    );

  const upcomingRentals =
    useMemo(
      () =>
        rentals.filter(
          (rental) =>
            rental.status ===
              "approved" &&
            rental.start_date >
              today
        ),
      [
        rentals,
        today,
      ]
    );

  const currentRentals =
    useMemo(
      () =>
        rentals.filter(
          (rental) =>
            (rental.status ===
              "approved" ||
              rental.status ===
                "active") &&
            rental.start_date <=
              today &&
            rental.end_date >=
              today
        ),
      [
        rentals,
        today,
      ]
    );

  const rentalHistory =
    useMemo(
      () =>
        rentals.filter(
          (rental) =>
            rental.status ===
              "rejected" ||
            rental.status ===
              "cancelled" ||
            rental.status ===
              "completed" ||
            ((rental.status ===
              "approved" ||
              rental.status ===
                "active") &&
              rental.end_date <
                today)
        ),
      [
        rentals,
        today,
      ]
    );

  const renderRentalCard = (
    rental: RentalRequest,
    section:
      | "pending"
      | "upcoming"
      | "current"
      | "history"
  ) => {
    const photo =
      rental.photo_urls?.[0];

    return (
      <article
        key={rental.id}
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      >
        <div className="flex flex-col md:flex-row">
          {photo ? (
            <div className="h-52 w-full shrink-0 overflow-hidden bg-gray-100 md:h-auto md:w-52">
              <img
                src={photo}
                alt={rental.tool_name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-52 w-full shrink-0 items-center justify-center bg-gray-100 md:h-auto md:w-52">
              <Package
                size={48}
                className="text-gray-300"
              />
            </div>
          )}

          <div className="flex-1 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  ToolDrop Rental
                </p>

                <h3 className="mt-1 text-xl font-bold text-[#001F3F]">
                  {rental.tool_name}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Owner:{" "}
                  <span className="font-semibold text-gray-700">
                    {rental.seller_name}
                  </span>
                </p>

                {rental.location && (
                  <p className="mt-1 text-sm text-gray-500">
                    {rental.location}
                  </p>
                )}
              </div>

              {section === "pending" && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Clock size={14} />
                  Pending
                </span>
              )}

              {section === "upcoming" && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                  <CalendarDays
                    size={14}
                  />
                  Approved
                </span>
              )}

              {section === "current" && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                  <CheckCircle2
                    size={14}
                  />
                  Currently Borrowed
                </span>
              )}

              {section === "history" &&
                rental.status ===
                  "rejected" && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">
                    <XCircle
                      size={14}
                    />
                    Rejected
                  </span>
                )}

              {section === "history" &&
                rental.status ===
                  "cancelled" && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                    <XCircle
                      size={14}
                    />
                    Cancelled
                  </span>
                )}

              {section === "history" &&
                rental.status !==
                  "rejected" &&
                rental.status !==
                  "cancelled" && (
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                    <CheckCircle2
                      size={14}
                    />
                    Past
                  </span>
                )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Start Date
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-800">
                  {formatDate(
                    rental.start_date
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {section ===
                  "current"
                    ? "Return By"
                    : "End Date"}
                </p>

                <p
                  className={`mt-1 text-sm font-semibold ${
                    section ===
                    "current"
                      ? "text-red-600"
                      : "text-gray-800"
                  }`}
                >
                  {formatDate(
                    rental.end_date
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Rental Total
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-800">
                  $
                  {Number(
                    rental.rental_price
                  ).toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Deposit
                </p>

                <p className="mt-1 text-sm font-semibold text-gray-800">
                  $
                  {Number(
                    rental.deposit
                  ).toFixed(2)}
                </p>
              </div>
            </div>

            {section ===
              "current" && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="font-semibold text-green-800">
                  You currently have this tool.
                </p>

                <p className="mt-1 text-sm text-green-700">
                  Return it by{" "}
                  <span className="font-bold">
                    {formatDate(
                      rental.end_date
                    )}
                  </span>
                  .
                </p>
              </div>
            )}

            {section ===
              "pending" && (
              <p className="mt-4 text-sm text-gray-500">
                Waiting for the tool owner
                to approve or reject your
                request.
              </p>
            )}

            {section ===
              "upcoming" && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="font-semibold text-blue-800">
                  Your rental was approved.
                </p>

                <p className="mt-1 text-sm text-blue-700">
                  Your rental begins{" "}
                  <span className="font-bold">
                    {formatDate(
                      rental.start_date
                    )}
                  </span>
                  .
                </p>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

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
          Track your rental requests,
          approved rentals, tools you are
          currently borrowing, and return
          dates.
        </p>
      </section>

      {errorMsg && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Clock size={20} />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Pending Requests
          </p>

          <p className="mt-1 text-2xl font-bold text-[#001F3F]">
            {pendingRequests.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <CalendarDays
              size={20}
            />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Upcoming
          </p>

          <p className="mt-1 text-2xl font-bold text-[#001F3F]">
            {upcomingRentals.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <Package size={20} />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Currently Borrowed
          </p>

          <p className="mt-1 text-2xl font-bold text-[#001F3F]">
            {currentRentals.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
            <CheckCircle2
              size={20}
            />
          </div>

          <p className="mt-4 text-sm text-gray-500">
            History
          </p>

          <p className="mt-1 text-2xl font-bold text-[#001F3F]">
            {rentalHistory.length}
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-8 flex items-center justify-center rounded-2xl border bg-white p-12 text-gray-500 shadow-sm">
          <Loader2
            size={22}
            className="mr-3 animate-spin"
          />
          Loading your rentals...
        </div>
      )}

      {!loading &&
        rentals.length === 0 && (
          <section className="mt-8 rounded-2xl border bg-white p-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <Package size={27} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#001F3F]">
              No rentals yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
              Rental requests and approved
              tools will appear here after
              you request equipment from
              ToolDrop.
            </p>

            <Link
              href="/tooldrop"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 font-semibold text-white transition hover:bg-[#003366]"
            >
              <Search size={17} />
              Browse ToolDrop
            </Link>
          </section>
        )}

      {!loading &&
        rentals.length > 0 && (
          <div className="mt-10 space-y-10">
            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#001F3F]">
                    Currently Borrowed
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Tools currently in your
                    possession, including
                    their return dates.
                  </p>
                </div>

                <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                  {currentRentals.length}
                </span>
              </div>

              {currentRentals.length >
              0 ? (
                <div className="mt-5 space-y-4">
                  {currentRentals.map(
                    (rental) =>
                      renderRentalCard(
                        rental,
                        "current"
                      )
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                  You aren't currently
                  borrowing any tools.
                </div>
              )}
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#001F3F]">
                    Upcoming Rentals
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Approved rentals that
                    have not started yet.
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                  {upcomingRentals.length}
                </span>
              </div>

              {upcomingRentals.length >
              0 ? (
                <div className="mt-5 space-y-4">
                  {upcomingRentals.map(
                    (rental) =>
                      renderRentalCard(
                        rental,
                        "upcoming"
                      )
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                  You don't have any
                  approved upcoming rentals.
                </div>
              )}
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#001F3F]">
                    Pending Requests
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Requests waiting for a
                    tool owner's decision.
                  </p>
                </div>

                <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                  {pendingRequests.length}
                </span>
              </div>

              {pendingRequests.length >
              0 ? (
                <div className="mt-5 space-y-4">
                  {pendingRequests.map(
                    (rental) =>
                      renderRentalCard(
                        rental,
                        "pending"
                      )
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                  You don't have any
                  pending rental requests.
                </div>
              )}
            </section>

            <section>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#001F3F]">
                    Rental History
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Past, cancelled, and
                    rejected rental requests.
                  </p>
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                  {rentalHistory.length}
                </span>
              </div>

              {rentalHistory.length >
              0 ? (
                <div className="mt-5 space-y-4">
                  {rentalHistory.map(
                    (rental) =>
                      renderRentalCard(
                        rental,
                        "history"
                      )
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                  No rental history yet.
                </div>
              )}
            </section>
          </div>
        )}
    </div>
  );
}
