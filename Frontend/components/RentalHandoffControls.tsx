"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { Camera, Loader2, PackageCheck, PackageOpen } from "lucide-react";

type Status = "pending" | "approved" | "pickup_pending" | "active" |
  "return_pending" | "completed" | "cancelled" | "rejected";
type Rental = {
  id: string;
  status: Status;
  start_date: string;
  end_date: string;
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

  const today = todayString();
  let action: "pickup/owner" | "pickup/borrower" | "return/borrower" | "return/owner" | null = null;
  let label = "";
  if (role === "owner" && rental.status === "approved" && rental.start_date <= today && rental.end_date >= today) {
    action = "pickup/owner";
    label = "Confirm Tool Handed Over";
  } else if (role === "borrower" && rental.status === "pickup_pending") {
    action = "pickup/borrower";
    label = "Confirm I Received Tool";
  } else if (role === "borrower" && rental.status === "active") {
    action = "return/borrower";
    label = "Submit Tool Return";
  } else if (role === "owner" && rental.status === "return_pending") {
    action = "return/owner";
    label = "Confirm Returned & Inspected";
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

  if (!action) {
    if (rental.status === "pickup_pending") return <p className="mt-3 text-xs font-semibold text-amber-700">Awaiting borrower pickup acknowledgement. Cancellation is locked.</p>;
    if (rental.status === "return_pending") return <p className="mt-3 text-xs font-semibold text-blue-700">Return submitted. Awaiting owner inspection.</p>;
    if (rental.status === "completed") return <p className="mt-3 text-xs font-semibold text-green-700">Return completed and confirmed.</p>;
    return null;
  }

  return (
    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
      <p className="text-xs text-gray-600">
        {action.startsWith("pickup") ? "Document the condition at pickup." : "Document the condition at return."}
        {" "}A condition photo is recommended (optional in this prototype).
      </p>
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
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {success && <p role="status" className="mt-2 text-xs text-green-700">{success}</p>}
    </div>
  );
}
