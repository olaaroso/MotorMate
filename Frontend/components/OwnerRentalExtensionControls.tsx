"use client";
import { useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { auth } from "@/lib/firebase";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
type Props = {
  rental: { id: string; tool_name: string; renter_name: string; end_date: string; daily_rate?: number; extension_request?: { status?: string; original_end_date?: string; requested_end_date?: string } };
  onUpdated: () => Promise<unknown> | void;
};
export default function OwnerRentalExtensionControls({ rental, onUpdated }: Props) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const request = rental.extension_request;
  const extraDays = request?.requested_end_date
    ? Math.max(0, Math.round((Date.parse(`${request.requested_end_date}T00:00:00Z`) - Date.parse(`${rental.end_date}T00:00:00Z`)) / 86400000))
    : 0;
  const extraCharge = rental.daily_rate === undefined ? null : Math.round(extraDays * rental.daily_rate * 100) / 100;
  if (request?.status !== "pending") return null;

  async function decide(approve: boolean) {
    const user = auth.currentUser;
    if (!user) { setError("Please sign in again."); return; }
    if (!window.confirm(approve ? "Approve the later return date?" : "Decline this extension request?")) return;
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${API}/api/diy/rental-requests/${encodeURIComponent(rental.id)}/extension/decision`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: user.uid, approve }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to review extension.");
      setNotice(approve ? "Extension approved." : "Extension declined.");
      await onUpdated();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to review extension."); }
    finally { setWorking(false); }
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-900"><CalendarClock size={17}/> Extension Request</p>
      <p className="mt-1 text-sm text-slate-700">{rental.renter_name} wants to extend <strong>{rental.tool_name}</strong> from <strong>{rental.end_date}</strong> to <strong>{request.requested_end_date}</strong>.</p>
      <p className="mt-2 text-sm font-semibold text-amber-900">{extraDays} additional {extraDays === 1 ? "day" : "days"}{extraCharge === null ? "" : ` · ${extraCharge.toLocaleString(undefined, { style: "currency", currency: "USD" })} added to the recorded rental total`}</p>
      <p className="mt-1 text-xs text-slate-600">Approval rechecks confirmed bookings. If another renter booked these dates, approval is blocked. MotorMate records added rental charges but does not automatically process payment.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={working} onClick={() => void decide(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{working ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>} Approve</button>
        <button type="button" disabled={working} onClick={() => void decide(false)} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"><XCircle size={15}/> Decline</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}
    </div>
  );
}
