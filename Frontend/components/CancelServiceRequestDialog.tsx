"use client";

import { useState } from "react";
import { Ban, Loader2, X } from "lucide-react";

import { announceNotificationsUpdated } from "@/lib/notifications";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const MAX_REASON_LENGTH = 500;

type CancelServiceRequestDialogProps<T> = {
  requestId: string;
  actorId: string;
  view: "mechanic" | "customer";
  /** Accepted appointments release their reserved time; pending requests never held any. */
  isAppointment: boolean;
  summary: string;
  otherPartyName: string;
  onClose: () => void;
  onCancelled: (request: T) => void;
};

export default function CancelServiceRequestDialog<T>({
  requestId,
  actorId,
  view,
  isAppointment,
  summary,
  otherPartyName,
  onClose,
  onCancelled,
}: CancelServiceRequestDialogProps<T>) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const noun = isAppointment ? "appointment" : "request";
  const Noun = isAppointment ? "Appointment" : "Request";

  const close = () => {
    if (!submitting) onClose();
  };

  const confirm = async () => {
    if (submitting || !actorId) return;

    try {
      setSubmitting(true);
      setError("");

      const trimmedReason = reason.trim();
      const response = await fetch(
        `${apiUrl}/api/service-requests/${encodeURIComponent(requestId)}/cancel`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor_id: actorId,
            view,
            ...(trimmedReason ? { reason: trimmedReason } : {}),
          }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : `Failed to cancel this ${noun}.`
        );
      }

      announceNotificationsUpdated();
      onCancelled(data.request as T);
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : `Failed to cancel this ${noun}.`
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-request-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600">
              Cancel {Noun}
            </p>
            <h2 id="cancel-request-title" className="mt-1 text-xl font-bold text-slate-950">
              Cancel this {noun}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {otherPartyName} will be notified
              {isAppointment ? " and the appointment time will be released" : ""}.
              This can&apos;t be undone from this screen.
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close cancellation dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">{summary}</p>
        </div>

        <label
          htmlFor="cancel-request-reason"
          className="mt-5 block text-sm font-semibold text-slate-700"
        >
          Reason <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="cancel-request-reason"
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          rows={3}
          disabled={submitting}
          onChange={(event) => {
            setReason(event.target.value);
            setError("");
          }}
          placeholder={`Let ${otherPartyName} know why, if you'd like`}
          className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] disabled:bg-slate-50"
        />
        <p className="mt-1 text-right text-xs text-slate-400">
          {reason.length}/{MAX_REASON_LENGTH}
        </p>

        {error && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Keep {Noun}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />}
            Cancel {Noun}
          </button>
        </div>
      </div>
    </div>
  );
}
