"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { AlertTriangle, Camera, Loader2, PackageCheck, PackageOpen, RotateCcw } from "lucide-react";

type Status = "pending" | "approved" | "pickup_pending" | "active" |
  "return_pending" | "completed" | "cancelled" | "rejected";
type Rental = {
  id: string;
  status: Status;
  start_date: string;
  end_date: string;
  handoff_issue_open?: boolean;
  handoff_issue?: { reason?: string; reported_by?: string };
};
type Props = {
  rental: Rental;
  role: "owner" | "borrower";
  onUpdated: () => Promise<void> | void;
};

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const todayString = () => {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

export default function RentalHandoffControls({ rental, role, onUpdated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [issueReason, setIssueReason] = useState("");
  const [showIssue, setShowIssue] = useState(false);

  const today = todayString();
  let action: "pickup/owner" | "pickup/borrower" | "return/borrower" | "return/owner" | null = null;
  let label = "";
  if (role === "owner" && rental.status === "approved" && rental.start_date <= today && rental.end_date >= today) {
    action = "pickup/owner";
    label = "I Have Handed the Tool to the Borrower";
  } else if (role === "borrower" && rental.status === "pickup_pending") {
    action = "pickup/borrower";
    label = "I Have Received the Tool";
  } else if (role === "borrower" && rental.status === "active") {
    action = "return/borrower";
    label = "I Have Returned the Tool";
  } else if (role === "owner" && rental.status === "return_pending") {
    action = "return/owner";
    label = "I Have Received and Inspected the Returned Tool";
  }

  const uploadPhoto = async (): Promise<string> => {
    if (!file) return "";
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      throw new Error("Choose an image smaller than 8 MB.");
    }
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloud || !preset) throw new Error("Cloudinary photo upload is not configured.");
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", preset);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {
      method: "POST", body: data,
    });
    if (!response.ok) throw new Error("Photo upload failed. Try again or submit without a photo.");
    const result = await response.json();
    if (!result.secure_url) throw new Error("Photo upload did not return a URL.");
    return result.secure_url;
  };

  const submit = async () => {
    if (!action || working) return;
    const user = auth.currentUser;
    if (!user) { setError("Please sign in again."); return; }
    if (!window.confirm(`${label}? Only confirm if this action actually happened.`)) return;
    setWorking(true);
    setError("");
    setSuccess("");
    try {
      const photo_url = await uploadPhoto();
      const key = role === "owner" ? "owner_id" : "renter_id";
      const response = await fetch(
        `${API}/api/diy/rental-requests/${encodeURIComponent(rental.id)}/${action}?${key}=${encodeURIComponent(user.uid)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_url, condition_notes: notes.trim() }),
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Unable to update rental.");
      setSuccess("Updated successfully.");
      setFile(null);
      setNotes("");
      await onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  };

  const sendExtra = async (path: string, body?: object) => {
    const user = auth.currentUser;
    if (!user) { setError("Please sign in again."); return; }
    setWorking(true); setError(""); setSuccess("");
    try {
      const key = role === "owner" ? "owner_id" : "renter_id";
      const url = path === "handoff/report"
        ? `${API}/api/diy/rental-requests/${encodeURIComponent(rental.id)}/${path}?role=${role}&user_id=${encodeURIComponent(user.uid)}`
        : `${API}/api/diy/rental-requests/${encodeURIComponent(rental.id)}/${path}?${key}=${encodeURIComponent(user.uid)}`;
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to update rental.");
      setShowIssue(false); setIssueReason("");
      setSuccess("Saved. Rental status updated.");
      await onUpdated();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update rental."); }
    finally { setWorking(false); }
  };

  const issueOpen = Boolean(rental.handoff_issue_open);
  const returnAction = action === "return/borrower" || action === "return/owner";
  // A dispute can pause pickup acknowledgement, but NEVER a physical return.
  const actionAllowed = !issueOpen || returnAction;
  const issueBanner = issueOpen ? (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
      <p className="font-semibold">Problem reported — follow-up still required</p>
      <p className="mt-1">{rental.handoff_issue?.reason || "A handoff issue was reported."}</p>
      <p className="mt-2">Returning the tool is still allowed. Confirming a physical return will not resolve or delete this report.</p>
      {role === "owner" && rental.status === "pickup_pending" && (
        <button type="button" disabled={working} onClick={() => { if (window.confirm("Withdraw your pickup confirmation?")) void sendExtra("pickup/undo-owner"); }}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold">Undo pickup confirmation</button>
      )}
    </div>
  ) : null;

  const description = action === "pickup/owner"
    ? "PICKUP — Only confirm after physically handing the tool to the borrower. They will then be asked to confirm receipt."
    : action === "pickup/borrower"
    ? "PICKUP — Have you physically received the tool? Do not confirm if you have not received it."
    : action === "return/borrower"
    ? "DROP-OFF — Only submit after actually giving the tool back to the owner. The owner still needs to inspect and confirm return."
    : action === "return/owner"
    ? "DROP-OFF — Only confirm after the tool has physically been returned and you have inspected its condition."
    : "";

  if (!action || !actionAllowed) {
    if (issueOpen && rental.status === "pickup_pending") {
      return <>{issueBanner}{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</>;
    }
    if (rental.status === "pickup_pending") return <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
      <p className="font-semibold">PICKUP — Waiting for borrower to confirm receipt</p>
      <p>{role === "owner" ? "You marked the tool as handed over. The borrower needs to confirm they physically received it." : "Pickup has been initiated. Please confirm receipt or report a problem."}</p>
      {role === "owner" && <button disabled={working} onClick={() => { if (window.confirm("Undo your handoff confirmation?")) void sendExtra("pickup/undo-owner"); }} className="mt-2 flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold"><RotateCcw size={15}/> Undo pickup confirmation</button>}
      {role === "borrower" && <button onClick={() => setShowIssue(true)} className="mt-2 underline">I did not receive this tool — Report problem</button>}
      {showIssue && <div className="mt-3"><textarea className="w-full rounded-lg border p-2" maxLength={1000} value={issueReason} onChange={e=>setIssueReason(e.target.value)} placeholder="Explain what happened (at least 5 characters)"/><button disabled={working || issueReason.trim().length<5} onClick={() => sendExtra("handoff/report",{reason:issueReason.trim()})} className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-white disabled:opacity-50">Submit problem report</button></div>}
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    </div>;
    if (rental.status === "return_pending") return <>{issueBanner}<p className="mt-3 text-sm font-semibold text-blue-700">DROP-OFF — Borrower reported returning the tool. Waiting for the owner to inspect and confirm it is back.</p></>;
    if (rental.status === "completed") return <>{issueBanner}<p className="mt-3 text-sm font-semibold text-green-700">RETURN CONFIRMED — The tool is back. Any reported problem remains on record.</p></>;
    return issueBanner;
  }

  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      {issueBanner}
      <p className="font-bold text-[#001F3F]">{action.startsWith("pickup") ? "PICKUP CONFIRMATION" : "DROP-OFF CONFIRMATION"}</p>
      <p className="mt-1 text-sm text-gray-700">{description}</p>
      <p className="mt-2 text-xs text-gray-600">Optional condition photo and notes provide evidence of the tool's condition.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-700">
          <Camera size={16} /> {file ? file.name : "Add condition photo"}
          <input type="file" accept="image/*" className="hidden" disabled={working}
            onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <input type="text" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Condition notes (optional)" aria-label="Condition notes"
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm" disabled={working} />
      </div>
      <button type="button" disabled={working} onClick={submit}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {working ? <Loader2 size={16} className="animate-spin" /> :
          action.startsWith("pickup") ? <PackageOpen size={16} /> : <PackageCheck size={16} />}
        {working ? "Saving..." : label}
      </button>
      {(rental.status === "pickup_pending" || rental.status === "active" || rental.status === "return_pending") && (
        <div className="mt-3">
          <button type="button" onClick={() => setShowIssue(v=>!v)} className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 underline"><AlertTriangle size={14}/> Something is wrong with this handoff</button>
          {showIssue && <div className="mt-2"><textarea value={issueReason} onChange={e=>setIssueReason(e.target.value)} maxLength={1000} placeholder="Describe what happened" className="w-full rounded-lg border bg-white p-2 text-sm"/><button disabled={working || issueReason.trim().length < 5} onClick={() => sendExtra("handoff/report", {reason: issueReason.trim()})} className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit problem report</button></div>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {success && <p role="status" className="mt-2 text-xs text-green-700">{success}</p>}
    </div>
  );
}
