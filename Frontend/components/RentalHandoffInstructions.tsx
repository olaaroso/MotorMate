"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardList, Loader2, MapPin, Navigation } from "lucide-react";

type Details = {
  pickup_address: string;
  pickup_instructions: string;
  dropoff_instructions: string;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function RentalHandoffInstructions({
  rentalId,
  status,
}: {
  rentalId: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const visible = !["pending", "rejected", "cancelled"].includes(status);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  // A rental can be reused by React after switching accounts/orders.
  useEffect(() => {
    controllerRef.current?.abort();
    setOpen(false);
    setDetails(null);
    setLoading(false);
    setError("");
  }, [rentalId]);

  async function toggle() {
    if (open) {
      controllerRef.current?.abort();
      setLoading(false);
      setOpen(false);
      return;
    }

    // Fetch only on explicit click, but refetch on EVERY open. This ensures
    // an owner saving instructions later updates the borrower's view.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setOpen(true);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/diy/handoff/rentals/${encodeURIComponent(rentalId)}`,
        { signal: controller.signal, cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Could not load pickup instructions.");
      }
      if (!controller.signal.aborted) {
        setDetails({
          pickup_address: String(data.pickup_address || ""),
          pickup_instructions: String(data.pickup_instructions || ""),
          dropoff_instructions: String(data.dropoff_instructions || ""),
        });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Could not load pickup instructions.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  if (!visible) return null;

  const mapsUrl = details?.pickup_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(details.pickup_address)}`
    : "";
  const hasInstructions = !!(
    details?.pickup_address || details?.pickup_instructions || details?.dropoff_instructions
  );

  return (
    <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 text-left font-bold text-[#001F3F]"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2"><MapPin size={18} /> Pickup & Drop-off Details</span>
        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>

      {open && (
        <div className="mt-3 border-t border-blue-100 pt-3">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading instructions...
            </p>
          )}
          {!loading && error && (
            <p role="alert" className="text-sm text-red-700">
              {error} Close and reopen this panel to retry.
            </p>
          )}
          {!loading && !error && details && (
            <div className="space-y-3 text-sm">
              {!hasInstructions && (
                <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-800">
                  No pickup or drop-off instructions have been configured for this tool yet. Please contact the owner to coordinate.
                </p>
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Pickup address</p>
                <p className="mt-1 font-semibold text-gray-800">
                  {details.pickup_address || "No pickup address provided yet."}
                </p>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline">
                    <Navigation size={14} /> Get directions
                  </a>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Pickup instructions</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-700">
                  {details.pickup_instructions || "No special pickup instructions provided."}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Drop-off instructions</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-700">
                  {details.dropoff_instructions || "No special drop-off instructions provided."}
                </p>
              </div>
              <p className="flex items-center gap-1 text-xs text-gray-500">
                <ClipboardList size={14} /> Instructions saved for this rental are shown above.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
