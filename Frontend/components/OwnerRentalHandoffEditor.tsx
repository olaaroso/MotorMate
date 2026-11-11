"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, MapPin, Save } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
type Details = { pickup_address: string; pickup_instructions: string; dropoff_instructions: string };
const blank: Details = { pickup_address: "", pickup_instructions: "", dropoff_instructions: "" };

export default function OwnerRentalHandoffEditor({
  rentalId, listingId, status,
}: { rentalId: string; listingId: string; status: string }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [details, setDetails] = useState<Details>(blank);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const editable = ["approved", "pickup_pending"].includes(status);

  async function openEditor() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (loaded) return;
    const user = auth.currentUser;
    if (!user) { setError("Sign in to view your rental instructions."); return; }
    setLoading(true); setError("");
    try {
      const [rentalResponse, listingResponse, profileSnapshot] = await Promise.all([
        fetch(`${API}/api/diy/handoff/rentals/${encodeURIComponent(rentalId)}`, { cache: "no-store" }),
        fetch(`${API}/api/diy/handoff/listings/${encodeURIComponent(listingId)}?owner_id=${encodeURIComponent(user.uid)}`, { cache: "no-store" }),
        getDoc(doc(db, "users", user.uid)),
      ]);
      const rental = await rentalResponse.json().catch(() => ({}));
      const listing = listingResponse.ok ? await listingResponse.json().catch(() => ({})) : {};
      const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
      if (!rentalResponse.ok) throw new Error(rental.detail || "Could not load rental instructions.");
      // Rental-specific values win, then tool defaults, then saved account defaults.
      // Older tool listings often have no private handoff record yet.
      const street = String(profile.streetAddress || "").trim();
      const area = [profile.city, profile.state, profile.zipCode]
        .filter(Boolean).join(", ").trim();
      const defaultAddress = street
        ? (area && !street.toLowerCase().includes(String(profile.city || "").toLowerCase())
          ? `${street}, ${area}` : street)
        : "";
      setDetails({
        pickup_address: rental.pickup_address || listing.pickup_address || defaultAddress,
        pickup_instructions: rental.pickup_instructions || listing.pickup_instructions || profile.defaultPickupInstructions || "",
        dropoff_instructions: rental.dropoff_instructions || listing.dropoff_instructions || profile.defaultDropoffInstructions || "",
      });
      setLoaded(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load instructions."); }
    finally { setLoading(false); }
  }

  async function save() {
    const user = auth.currentUser;
    if (!user) { setError("Sign in to save instructions."); return; }
    if (!details.pickup_address.trim()) { setError("Enter a pickup address for this order."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API}/api/diy/handoff/rentals/${encodeURIComponent(rentalId)}?owner_id=${encodeURIComponent(user.uid)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to save order instructions.");
      setDetails({ pickup_address: data.pickup_address, pickup_instructions: data.pickup_instructions, dropoff_instructions: data.dropoff_instructions });
      setSuccess("Saved for this rental only. Your tool's default instructions were not changed.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save instructions."); }
    finally { setSaving(false); }
  }

  const field = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#001F3F]";
  return (
    <section className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3 sm:p-4">
      <button type="button" onClick={openEditor} aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-[#001F3F]">
        <span className="flex items-center gap-2"><MapPin size={17} /> {editable ? "View / Edit Pickup & Drop-off Instructions for This Rental" : "View Pickup & Drop-off Instructions"}</span>
        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
      {open && (
        <div className="mt-4 space-y-3 border-t border-blue-100 pt-4">
          <p className="text-xs text-slate-500">Instructions are automatic for approved rentals. Edit and save here only to override this specific order; your defaults stay unchanged.</p>
          {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" /> Loading saved instructions...</p>}
          {!loading && loaded && <>
            <label className="block text-sm font-semibold text-slate-700">Pickup address
              <input disabled={!editable} value={details.pickup_address} onChange={e=>setDetails(d=>({...d,pickup_address:e.target.value}))} className={field} maxLength={300} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Pickup instructions
              <textarea disabled={!editable} rows={2} maxLength={1200} value={details.pickup_instructions} onChange={e=>setDetails(d=>({...d,pickup_instructions:e.target.value}))} className={field} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">Drop-off instructions
              <textarea disabled={!editable} rows={2} maxLength={1200} value={details.dropoff_instructions} onChange={e=>setDetails(d=>({...d,dropoff_instructions:e.target.value}))} className={field} />
            </label>
            {editable && <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save for This Rental
            </button>}
            {!editable && <p className="text-xs text-slate-500">Instructions are read-only after pickup is completed.</p>}
          </>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16} />{success}</p>}
        </div>
      )}
    </section>
  );
}
