
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
  AlertTriangle,
} from "lucide-react";

import { auth } from "@/lib/firebase";

type RentalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "completed"
  | "cancelled";

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
  status: RentalStatus;
  created_at?: string;
  approved_at?: string;
  rejected_at?: string;
  cancelled_at?: string;
};

type RentalSection =
  | "pending"
  | "upcoming"
  | "current"
  | "history";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

function getTodayString() {
  const now = new Date();
  const timezoneOffset =
    now.getTimezoneOffset() * 60 * 1000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .split("T")[0];
}

function formatDate(dateString: string) {
  if (!dateString) return "";

  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function MyRentalsPage() {
  const [rentals, setRentals] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Sprint 3: Borrower cancellation states
  const [rentalToCancel, setRentalToCancel] =
    useState<RentalRequest | null>(null);

  const [cancellingId, setCancellingId] =
    useState<string | null>(null);

  const today = getTodayString();

  // LOAD RENTALS
  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          if (!cancelled) {
            setRentals([]);
            setLoading(false);
          }
          return;
        }

        try {
          setLoading(true);
          setErrorMsg("");

          const response = await fetch(
            `${apiUrl}/api/diy/rental-requests/renter/${user.uid}`
          );

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.detail || "Failed to load your rentals."
            );
          }

          if (!cancelled) {
            setRentals(data.results || []);
          }
        } catch (error) {
          if (!cancelled) {
            setErrorMsg(
              error instanceof Error
                ? error.message
                : "Failed to load your rentals."
            );
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // SPRINT 3: CANCELLATION ELIGIBILITY
  const canCancelRental = (rental: RentalRequest) => {
  if (rental.status === "pending") return true;

  return (
    rental.status === "approved" &&
    rental.start_date >= today
  );
  };

  const openCancelModal = (rental: RentalRequest) => {
    if (!canCancelRental(rental)) return;

    setErrorMsg("");
    setSuccessMsg("");
    setRentalToCancel(rental);
  };

  // SPRINT 3: BORROWER CANCELLATION API
  const handleConfirmCancel = async () => {
    if (!rentalToCancel || cancellingId) return;

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setErrorMsg("You must be signed in to cancel a rental.");
      setRentalToCancel(null);
      return;
    }

    if (
      rentalToCancel.renter_id !== currentUser.uid
    ) {
      setErrorMsg("You can only cancel your own rentals.");
      setRentalToCancel(null);
      return;
    }

    if (!canCancelRental(rentalToCancel)) {
      setErrorMsg(
        "This reservation is no longer eligible for cancellation."
      );
      setRentalToCancel(null);
      return;
    }

    const rentalId = rentalToCancel.id;

    try {
      setCancellingId(rentalId);
      setErrorMsg("");
      setSuccessMsg("");

      const response = await fetch(
        `${apiUrl}/api/diy/rental-requests/${encodeURIComponent(
          rentalId
        )}/borrower-cancel?renter_id=${encodeURIComponent(
          currentUser.uid
        )}`,
        {
          method: "PATCH",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `Cancellation failed (${response.status}).`
        );
      }

      // Update immediately in the UI.
      setRentals((previous) =>
        previous.map((rental) =>
          rental.id === rentalId
            ? {
                ...rental,
                status: "cancelled" as RentalStatus,
                cancelled_at: new Date().toISOString(),
              }
            : rental
        )
      );

      setSuccessMsg(
        "Your reservation was cancelled successfully. It has been moved to Rental History."
      );

      setRentalToCancel(null);

      // Refresh with the authoritative database result.
      try {
        const refreshResponse = await fetch(
          `${apiUrl}/api/diy/rental-requests/renter/${currentUser.uid}`
        );

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          setRentals(refreshData.results || []);
        }
      } catch {
        // The successful local cancellation remains visible.
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Unable to cancel this reservation."
      );
      setRentalToCancel(null);
    } finally {
      setCancellingId(null);
    }
  };

  // RENTAL GROUPS
  const pendingRequests = useMemo(
    () => rentals.filter((r) => r.status === "pending"),
    [rentals]
  );

  const upcomingRentals = useMemo(
    () =>
      rentals.filter(
        (r) =>
          r.status === "approved" &&
          r.start_date > today
      ),
    [rentals, today]
  );

  const currentRentals = useMemo(
    () =>
      rentals.filter(
        (r) =>
          (r.status === "approved" ||
            r.status === "active") &&
          r.start_date <= today &&
          r.end_date >= today
      ),
    [rentals, today]
  );

  const rentalHistory = useMemo(
    () =>
      rentals.filter(
        (r) =>
          r.status === "rejected" ||
          r.status === "cancelled" ||
          r.status === "completed" ||
          ((r.status === "approved" ||
            r.status === "active") &&
            r.end_date < today)
      ),
    [rentals, today]
  );

  // STATUS BADGE
  const renderStatus = (
    rental: RentalRequest,
    section: RentalSection
  ) => {
    const styles = {
      pending: "bg-amber-50 text-amber-700",
      upcoming: "bg-blue-50 text-blue-700",
      current: "bg-green-50 text-green-700",
      history: "bg-gray-100 text-gray-600",
    };

    let label = "";

    if (section === "pending") label = "Pending";
    else if (section === "upcoming") label = "Approved";
    else if (section === "current") label = "Currently Borrowed";
    else {
      label =
        rental.status === "cancelled"
          ? "Cancelled"
          : rental.status === "rejected"
            ? "Rejected"
            : "Past";
    }

    return (
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${styles[section]}`}
      >
        {section === "pending" ? (
          <Clock size={14} />
        ) : section === "upcoming" ? (
          <CalendarDays size={14} />
        ) : section === "current" ? (
          <CheckCircle2 size={14} />
        ) : (
          <XCircle size={14} />
        )}
        {label}
      </span>
    );
  };

  // RENTAL CARD
  const renderRentalCard = (
    rental: RentalRequest,
    section: RentalSection
  ) => {
    const photo = rental.photo_urls?.[0];
    const eligible = canCancelRental(rental);
    const isCancelling = cancellingId === rental.id;

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
              <Package size={48} className="text-gray-300" />
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

              {renderStatus(rental, section)}
            </div>

            {/* RENTAL DETAILS */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Start Date
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-800">
                  {formatDate(rental.start_date)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {section === "current"
                    ? "Return By"
                    : "End Date"}
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    section === "current"
                      ? "text-red-600"
                      : "text-gray-800"
                  }`}
                >
                  {formatDate(rental.end_date)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Rental Total
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-800">
                  {formatMoney(rental.rental_price)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Deposit
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-800">
                  {formatMoney(rental.deposit)}
                </p>
              </div>
            </div>

            {/* CURRENT RENTAL */}
            {section === "current" && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="font-semibold text-green-800">
                  You currently have this tool.
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Return it by{" "}
                  <span className="font-bold">
                    {formatDate(rental.end_date)}
                  </span>
                  .
                </p>
              </div>
            )}

            {/* PENDING REQUEST */}
            {section === "pending" && (
              <p className="mt-4 text-sm text-gray-500">
                Waiting for the tool owner to approve or
                reject your request.
              </p>
            )}

            {/* UPCOMING RENTAL */}
            {section === "upcoming" && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="font-semibold text-blue-800">
                  Your rental was approved.
                </p>
                <p className="mt-1 text-sm text-blue-700">
                  Your rental begins{" "}
                  <span className="font-bold">
                    {formatDate(rental.start_date)}
                  </span>
                  .
                </p>
              </div>
            )}

            {/* SPRINT 3: CANCEL BUTTON */}
            {eligible && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-gray-500">
                  Cancellation available through{" "}
                  {formatDate(rental.start_date)}.
                </p>

                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={() => openCancelModal(rental)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCancelling ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <XCircle size={17} />
                  )}
                  {rental.status === "pending"
                    ? "Cancel Request"
                    : "Cancel Reservation"}
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  // REUSABLE SECTION
  const renderSection = (
    title: string,
    description: string,
    items: RentalRequest[],
    section: RentalSection,
    emptyMessage: string
  ) => {
    const countColor = {
      pending: "bg-amber-50 text-amber-700",
      upcoming: "bg-blue-50 text-blue-700",
      current: "bg-green-50 text-green-700",
      history: "bg-gray-100 text-gray-600",
    }[section];

    return (
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#001F3F]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {description}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${countColor}`}
          >
            {items.length}
          </span>
        </div>

        {items.length > 0 ? (
          <div className="mt-5 space-y-4">
            {items.map((rental) =>
              renderRentalCard(rental, section)
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* HEADER */}
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          ToolDrop
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">
          My Rentals
        </h1>
        <p className="mt-2 max-w-2xl text-gray-500">
          Track your rental requests, approved rentals,
          tools you are currently borrowing, and return
          dates.
        </p>
      </section>

      {/* ERROR MESSAGE */}
      {errorMsg && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {errorMsg}
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {successMsg && (
        <div
          role="status"
          className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {successMsg}
        </div>
      )}

      {/* DASHBOARD STAT CARDS */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Pending Requests",
            count: pendingRequests.length,
            icon: Clock,
            color: "bg-amber-50 text-amber-700",
          },
          {
            label: "Upcoming",
            count: upcomingRentals.length,
            icon: CalendarDays,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Currently Borrowed",
            count: currentRentals.length,
            icon: Package,
            color: "bg-green-50 text-green-700",
          },
          {
            label: "History",
            count: rentalHistory.length,
            icon: CheckCircle2,
            color: "bg-gray-100 text-gray-600",
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
              >
                <Icon size={20} />
              </div>
              <p className="mt-4 text-sm text-gray-500">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-[#001F3F]">
                {stat.count}
              </p>
            </div>
          );
        })}
      </div>

      {/* LOADING */}
      {loading && (
        <div className="mt-8 flex items-center justify-center rounded-2xl border bg-white p-12 text-gray-500 shadow-sm">
          <Loader2
            size={22}
            className="mr-3 animate-spin"
          />
          Loading your rentals...
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && rentals.length === 0 && (
        <section className="mt-8 rounded-2xl border bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
            <Package size={27} />
          </div>

          <h2 className="mt-5 text-xl font-bold text-[#001F3F]">
            No rentals yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            Rental requests and approved tools will
            appear here after you request equipment
            from ToolDrop.
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

      {/* RENTAL SECTIONS */}
      {!loading && rentals.length > 0 && (
        <div className="mt-10 space-y-10">
          {renderSection(
            "Currently Borrowed",
            "Tools currently in your possession, including their return dates.",
            currentRentals,
            "current",
            "You aren't currently borrowing any tools."
          )}

          {renderSection(
            "Upcoming Rentals",
            "Approved rentals that have not started yet.",
            upcomingRentals,
            "upcoming",
            "You don't have any approved upcoming rentals."
          )}

          {renderSection(
            "Pending Requests",
            "Requests waiting for a tool owner's decision.",
            pendingRequests,
            "pending",
            "You don't have any pending rental requests."
          )}

          {renderSection(
            "Rental History",
            "Past, cancelled, and rejected rental requests.",
            rentalHistory,
            "history",
            "No rental history yet."
          )}
        </div>
      )}

      {/* SPRINT 3: CANCELLATION CONFIRMATION MODAL */}
      {rentalToCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !cancellingId
            ) {
              setRentalToCancel(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-rental-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle size={25} />
              </div>

              <div>
                <h2
                  id="cancel-rental-title"
                  className="text-xl font-bold text-[#001F3F]"
                >
                  Cancel Reservation?
                </h2>

                <p className="text-sm text-gray-500">
                  Please confirm your cancellation.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-gray-50 p-4">
              <p className="font-semibold text-[#001F3F]">
                {rentalToCancel.tool_name}
              </p>

              <p className="mt-2 text-sm text-gray-600">
                {formatDate(rentalToCancel.start_date)}
                {" — "}
                {formatDate(rentalToCancel.end_date)}
              </p>

              <p className="mt-2 text-sm text-gray-600">
                Rental Total:{" "}
                {formatMoney(rentalToCancel.rental_price)}
              </p>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-600">
              {rentalToCancel.status === "pending"
                ? "Your pending request will be withdrawn. The tool owner will be notified."
                : "Your approved reservation will be cancelled and its reserved dates will become available to other borrowers."}
            </p>

            <p className="mt-2 text-xs text-gray-500">
              This action cannot be undone.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={Boolean(cancellingId)}
                onClick={() => setRentalToCancel(null)}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Keep Reservation
              </button>

              <button
                type="button"
                disabled={Boolean(cancellingId)}
                onClick={handleConfirmCancel}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancellingId ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle size={16} />
                    Confirm Cancellation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
