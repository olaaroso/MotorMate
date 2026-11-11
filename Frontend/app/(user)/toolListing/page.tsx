"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  ArrowLeft, Camera, CheckCircle2, DollarSign, Loader2, MapPin,
  Plus, ShieldCheck, ToolCase, UserRound, X,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const categories = ["Hand Tools", "Power Tools", "Lifting", "Diagnostics", "Electrical", "Engine Tools", "Brake Tools", "Other"];
type UserProfile = {
  firstName: string; lastName: string; city: string; state: string; zipCode: string; phone: string;
  streetAddress?: string; defaultPickupInstructions?: string; defaultDropoffInstructions?: string;
};

export default function ToolListingPage() {
  const [toolName, setToolName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [deposit, setDeposit] = useState("");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("Good");
  const [available, setAvailable] = useState(true);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [warning, setWarning] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [dropoffInstructions, setDropoffInstructions] = useState("");
  const [rememberHandoff, setRememberHandoff] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setProfile(null); setProfileLoading(false); return; }
      setProfileLoading(true);
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const data = snapshot.exists() ? snapshot.data() : {};
        const p: UserProfile = {
          firstName: data.firstName || "", lastName: data.lastName || "", city: data.city || "",
          state: data.state || "", zipCode: data.zipCode || "", phone: data.phone || "",
          streetAddress: data.streetAddress || "",
          defaultPickupInstructions: data.defaultPickupInstructions || "",
          defaultDropoffInstructions: data.defaultDropoffInstructions || "",
        };
        setProfile(p);
        if (p.city && p.state) setLocation(`${p.city}, ${p.state}`);
        setPickupAddress(p.streetAddress && (p.streetAddress.includes(p.city) || p.streetAddress.includes(p.zipCode))
          ? p.streetAddress : [p.streetAddress, p.city, p.state, p.zipCode].filter(Boolean).join(", "));
        setPickupInstructions(p.defaultPickupInstructions || "");
        setDropoffInstructions(p.defaultDropoffInstructions || "");
      } catch (e) { console.error(e); setErrorMsg("Unable to load your account information."); }
      finally { setProfileLoading(false); }
    });
    return () => unsub();
  }, []);

  const sellerName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
  const profileComplete = !!(profile?.firstName.trim() && profile?.lastName.trim() && profile?.city.trim() && profile?.state.trim() && profile?.zipCode.trim());
  const field = "mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#001F3F]";

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErrorMsg("Please select an image file."); return; }
    if (photoUrls.length >= 3) { setErrorMsg("You can upload a maximum of 3 photos."); return; }
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) { setErrorMsg("Cloudinary configuration is missing."); return; }
    setUploadingPhoto(true); setErrorMsg("");
    try {
      const form = new FormData(); form.append("file", file); form.append("upload_preset", preset);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok || !data.secure_url) throw new Error("Unable to upload this image.");
      setPhotoUrls(prev => [...prev, data.secure_url]);
    } catch (e) { setErrorMsg(e instanceof Error ? e.message : "Could not upload photo."); }
    finally { setUploadingPhoto(false); event.target.value = ""; }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted || loading) return;
    const user = auth.currentUser;
    if (!user) { setErrorMsg("Sign in to publish a tool."); return; }
    if (!profileComplete) { setErrorMsg("Complete your profile before listing a tool."); return; }
    const price = Number(dailyRate), depositAmount = Number(deposit || 0);
    if (!(price > 0) || depositAmount < 0 || !Number.isFinite(price) || !Number.isFinite(depositAmount)) { setErrorMsg("Enter a valid daily price and deposit."); return; }
    if (!toolName.trim() || !category || !description.trim() || !location.trim()) { setErrorMsg("Complete the required tool fields."); return; }
    if (!pickupAddress.trim()) { setErrorMsg("Add the pickup address before publishing."); return; }
    setLoading(true); setErrorMsg(""); setWarning("");
    try {
      const response = await fetch(`${API}/api/diy/listings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: user.uid, seller_name: sellerName, item_name: toolName.trim(), category, condition,
          price, deposit: depositAmount, location: location.trim(), zip_code: profile?.zipCode || "",
          availability: available ? "available" : "unavailable", description: description.trim(),
          specifications: specifications.trim() || null, photo_urls: photoUrls, distance: 0, rating: 0, reviews: 0,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to create listing.");
      const listingId = data.listing?.id;
      if (!listingId) throw new Error("Listing created, but no listing ID was returned. Set the instructions in My Tools.");
      // Mark published before the private-details request: a failed second request must not create duplicate listings.
      setSubmitted(true);
      try {
        const privateResponse = await fetch(`${API}/api/diy/handoff/listings/${listingId}?owner_id=${encodeURIComponent(user.uid)}`, {
          method: "PUT", headers: { "Content-Type": "application/json", },
          body: JSON.stringify({
            pickup_address: pickupAddress.trim(), pickup_instructions: pickupInstructions.trim(),
            dropoff_instructions: dropoffInstructions.trim(),
          }),
        });
        const privateData = await privateResponse.json().catch(() => ({}));
        if (!privateResponse.ok) throw new Error(privateData.detail || `HTTP ${privateResponse.status}`);
        if (rememberHandoff) {
          await setDoc(doc(db, "users", user.uid), {
            streetAddress: pickupAddress.trim(),
            defaultPickupInstructions: pickupInstructions.trim(),
            defaultDropoffInstructions: dropoffInstructions.trim(),
          }, { merge: true });
        }
      } catch (e) {
        setWarning(`Your tool listing was published, but pickup details need attention: ${e instanceof Error ? e.message : "Unable to save details"}. Open My Tools to finish setup.`);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unable to publish listing.");
    } finally { setLoading(false); }
  }

  if (profileLoading) return <div className="mx-auto flex max-w-7xl items-center justify-center p-16 text-gray-500"><Loader2 size={20} className="mr-2 animate-spin"/>Loading account information...</div>;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <Link href="/tooldrop" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500"><ArrowLeft size={16}/> Back to ToolDrop</Link>
      <div className="mt-4 flex items-center justify-between gap-5">
        <div><p className="text-sm font-semibold uppercase text-blue-600">Tool Owner</p><h1 className="mt-1 text-3xl font-bold text-[#001F3F]">List a Tool</h1><p className="mt-2 text-gray-500">Create a listing and tell your borrower where and how to pick it up.</p></div>
        <div className="hidden items-center gap-2 rounded-xl border bg-white p-4 text-[#001F3F] md:flex"><ShieldCheck/> Owner Protection</div>
      </div>
      {!profileComplete && <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900"><h2 className="font-bold">Complete your profile first</h2><p className="mt-2 text-sm">Your name, city, state, and ZIP code are needed to list a tool.</p><Link href="/account" className="mt-3 inline-block font-semibold underline">Open Account Settings</Link></section>}
      {profileComplete && <section className="mt-6 flex items-center justify-between rounded-xl border bg-white p-4 text-sm"><span>Listing as <strong>{sellerName}</strong></span><Link href="/account" className="font-semibold text-blue-700">Edit Profile</Link></section>}
      {submitted && <section role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={19}/> Listing published successfully!</div><Link href="/myTools" className="mt-2 inline-block text-sm font-semibold underline">Manage your tool in My Tools</Link></section>}
      {warning && <section role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{warning}</section>}
      {errorMsg && <section role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{errorMsg}</section>}
      <form onSubmit={submit} className={`mt-8 grid gap-8 xl:grid-cols-[1fr_360px] ${!profileComplete ? "pointer-events-none opacity-50" : ""}`}>
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 border-b pb-5 text-xl font-bold text-[#001F3F]"><ToolCase size={20}/> Tool Information</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="text-sm font-semibold text-gray-700 md:col-span-2">Tool Name<input required value={toolName} onChange={e => setToolName(e.target.value)} placeholder="Milwaukee Cordless Impact Wrench" className={field}/></label>
              <label className="text-sm font-semibold text-gray-700">Category<select required value={category} onChange={e => setCategory(e.target.value)} className={field}><option value="">Select a category</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="text-sm font-semibold text-gray-700">Condition<select value={condition} onChange={e => setCondition(e.target.value)} className={field}>{["Like New", "Excellent", "Good", "Fair"].map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="text-sm font-semibold text-gray-700 md:col-span-2">Description<textarea required rows={5} maxLength={500} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the tool and included accessories" className={field}/><span className="mt-1 block text-right text-xs text-gray-400">{description.length}/500</span></label>
              <label className="text-sm font-semibold text-gray-700 md:col-span-2">Specifications<textarea rows={3} value={specifications} onChange={e => setSpecifications(e.target.value)} placeholder="Capacity, voltage, supported vehicles..." className={field}/></label>
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-bold text-[#001F3F]"><Camera size={20}/> Tool Photos</h2><p className="mt-2 text-sm text-gray-500">Upload up to three photos showing the tool.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{[0,1,2].map(index => photoUrls[index] ?
              <div key={index} className="relative h-36 overflow-hidden rounded-xl border bg-gray-100"><img src={photoUrls[index]} alt={`Tool photo ${index + 1}`} className="h-full w-full object-cover"/><button type="button" aria-label="Remove photo" onClick={() => setPhotoUrls(old => old.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X size={16}/></button></div> :
              <label key={index} className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-gray-50 text-gray-500">{uploadingPhoto ? <Loader2 className="animate-spin"/> : <Plus size={24}/>}<span className="mt-1 text-xs">Add photo</span><input type="file" accept="image/*" disabled={uploadingPhoto || submitted} onChange={uploadPhoto} className="hidden"/></label>)}</div>
          </section>
          <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-xl font-bold text-[#001F3F]"><MapPin size={20}/> Pickup & Drop-off Details</h2>
            <p className="mt-2 text-sm text-gray-500">Autofilled from Account Settings. Only you and approved borrowers can access the full address and instructions.</p>
            <label className="mt-5 block text-sm font-semibold text-gray-700">Exact pickup address<input required maxLength={300} value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} placeholder="Street, City, State, ZIP" className={field}/></label>
            <label className="mt-4 block text-sm font-semibold text-gray-700">Pickup instructions<textarea rows={3} maxLength={1200} value={pickupInstructions} onChange={e => setPickupInstructions(e.target.value)} placeholder="Message when you arrive. Meet me in the driveway." className={field}/></label>
            <label className="mt-4 block text-sm font-semibold text-gray-700">Drop-off instructions<textarea rows={3} maxLength={1200} value={dropoffInstructions} onChange={e => setDropoffInstructions(e.target.value)} placeholder="Return with all accessories and leave it at the front door." className={field}/></label>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={rememberHandoff} onChange={e => setRememberHandoff(e.target.checked)}/> Save these as my defaults for future listings</label>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-bold text-[#001F3F]"><DollarSign size={20}/> Rental Pricing</h2>
            <label className="mt-5 block text-sm font-semibold text-gray-700">Daily Rental Rate ($)<input type="number" min="0.01" step="0.01" required value={dailyRate} onChange={e => setDailyRate(e.target.value)} className={field}/></label>
            <label className="mt-4 block text-sm font-semibold text-gray-700">Security Deposit ($)<input type="number" min="0" step="0.01" value={deposit} onChange={e => setDeposit(e.target.value)} className={field}/></label>
          </section>
          <section className="rounded-2xl border bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-bold text-[#001F3F]"><MapPin size={20}/> Public Location</h2>
            <p className="mt-2 text-xs text-gray-500">Only this general location appears publicly.</p>
            <label className="mt-4 block text-sm font-semibold text-gray-700">City, State<input required value={location} onChange={e => setLocation(e.target.value)} className={field}/></label>
            <label className="mt-5 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)}/> Available to rent</label>
          </section>
          <button type="submit" disabled={!profileComplete || loading || submitted || uploadingPhoto} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3.5 font-semibold text-white disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={19}/> : <Plus size={19}/>} {loading ? "Publishing..." : submitted ? "Listing Published" : "Publish Listing"}</button>
          <p className="text-center text-xs text-gray-500">Owner approval is required before a borrower receives your exact pickup address.</p>
        </aside>
      </form>
    </div>
  );
}
