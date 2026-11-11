"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { CheckCircle2, Loader2, Save } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function OwnerHandoffEditor({ listingId }: { listingId: string }) {
  const [address, setAddress] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const user = auth.currentUser;
      if (!user) { if (alive) setLoading(false); return; }
      try {
        const [res, snapshot] = await Promise.all([
          fetch(`${API}/api/diy/handoff/listings/${encodeURIComponent(listingId)}?owner_id=${encodeURIComponent(user.uid)}`, {
            headers: {  }, cache: "no-store",
          }),
          getDoc(doc(db, "users", user.uid)),
        ]);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Could not load handoff details");
        const defaults = snapshot.exists() ? snapshot.data() : {};
        const storedAddress = defaults.streetAddress || "";
        const suggestedAddress = storedAddress && (storedAddress.includes(defaults.city || "NOT_A_CITY") || storedAddress.includes(defaults.zipCode || "NOT_A_ZIP"))
          ? storedAddress
          : [storedAddress, defaults.city, defaults.state, defaults.zipCode].filter(Boolean).join(", ");
        if (alive) {
          setAddress(data.pickup_address || suggestedAddress);
          setPickup(data.pickup_instructions || defaults.defaultPickupInstructions || "");
          setDropoff(data.dropoff_instructions || defaults.defaultDropoffInstructions || "");
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load pickup details");
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [listingId]);

  async function save() {
    const user = auth.currentUser;
    if (!user) { setError("Sign in to save handoff details."); return; }
    if (!address.trim()) { setError("A pickup address is required before this tool can be approved for rental."); return; }
    setWorking(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API}/api/diy/handoff/listings/${encodeURIComponent(listingId)}?owner_id=${encodeURIComponent(user.uid)}`, {
        method: "PUT", headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ pickup_address: address.trim(), pickup_instructions: pickup.trim(), dropoff_instructions: dropoff.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not save handoff details");
      if (remember) {
        await setDoc(doc(db, "users", user.uid), {
          streetAddress: address.trim(), defaultPickupInstructions: pickup.trim(),
          defaultDropoffInstructions: dropoff.trim(),
        }, { merge: true });
      }
      setSuccess("Saved. Newly approved rentals use these details; already-approved rentals keep their original instructions.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save handoff details"); }
    finally { setWorking(false); }
  }

  const field = "mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#001F3F]";
  return (
    <section className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <h3 className="font-bold text-[#001F3F]">Pickup & Drop-off Instructions</h3>
      <p className="mt-1 text-xs text-gray-500">Pickup details for borrowers with approved rentals. Saved account defaults are suggested when this tool has no custom instructions.</p>
      {loading ? <p className="mt-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="animate-spin" size={15}/> Loading details...</p> : (
        <>
          <label className="mt-4 block text-sm font-semibold text-gray-700">Exact pickup address<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, State, ZIP" className={field}/></label>
          <label className="mt-4 block text-sm font-semibold text-gray-700">Pickup instructions<textarea rows={3} maxLength={1200} value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Message when you arrive; I'll meet you outside." className={field}/></label>
          <label className="mt-4 block text-sm font-semibold text-gray-700">Drop-off instructions<textarea rows={3} maxLength={1200} value={dropoff} onChange={e => setDropoff(e.target.value)} placeholder="Return all accessories and leave the tool with me." className={field}/></label>
          <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/> Save as my default instructions for future listings</label>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-green-700"><CheckCircle2 size={16}/>{success}</p>}
          <button type="button" disabled={working} onClick={save} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{working ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Save Handoff Details</button>
        </>
      )}
    </section>
  );
}
