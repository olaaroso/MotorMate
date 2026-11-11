"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Camera, CheckCircle2, Loader2, Mail, MapPin, Phone, Save, User, Truck } from "lucide-react";
import { auth, db } from "@/lib/firebase";

export default function AccountSettingsPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [defaultPickupInstructions, setDefaultPickupInstructions] = useState("");
  const [defaultDropoffInstructions, setDefaultDropoffInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [photoMenu, setPhotoMenu] = useState(false);
  const photoMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (photoMenuRef.current && !photoMenuRef.current.contains(event.target as Node)) setPhotoMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setLoading(false); return; }
      try {
        setEmail(user.email || "");
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          const d = snapshot.data();
          setPhone(d.phone || "");
          setFirstName(d.firstName || "");
          setLastName(d.lastName || "");
          setProfileImage(d.profileImage || "");
          setCity(d.city || "");
          setState(d.state || "");
          setZipCode(d.zipCode || "");
          setStreetAddress(d.streetAddress || "");
          setDefaultPickupInstructions(d.defaultPickupInstructions || "");
          setDefaultDropoffInstructions(d.defaultDropoffInstructions || "");
        }
      } catch (e) {
        console.error("Failed to load account:", e);
        setError("Unable to load your account information.");
      } finally { setLoading(false); }
    });
    return () => unsub();
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const user = auth.currentUser;
    if (!user) { setError("You must be signed in to update your account."); return; }
    setSaving(true); setSaved(false); setError("");
    try {
      await setDoc(doc(db, "users", user.uid), {
        email: user.email, phone, firstName, lastName, profileImage, city, state, zipCode,
        streetAddress: streetAddress.trim(),
        defaultPickupInstructions: defaultPickupInstructions.trim(),
        defaultDropoffInstructions: defaultDropoffInstructions.trim(),
      }, { merge: true });
      setSaved(true);
    } catch (e) {
      console.error("Save account failed", e);
      setError("Could not save your account details.");
    } finally { setSaving(false); }
  }

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    setUploadingImage(true); setError(""); setPhotoMenu(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "motormate_tools");
      const response = await fetch("https://api.cloudinary.com/v1_1/omki7dtk/image/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok || !result.secure_url) throw new Error("Photo upload failed");
      setProfileImage(result.secure_url);
    } catch (e) { console.error(e); setError("Failed to upload profile picture."); }
    finally { setUploadingImage(false); event.target.value = ""; }
  }

  const field = "mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#001F3F]";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";
  if (loading) return <div className="mx-auto max-w-5xl p-8 text-gray-500">Loading account...</div>;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Account</p>
      <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">Account Settings</h1>
      <p className="mt-2 text-gray-500">Manage your profile and private ToolDrop handoff defaults.</p>
      {saved && <div role="status" className="mt-6 flex gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700"><CheckCircle2 size={19}/> Profile and ToolDrop defaults saved.</div>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      <form onSubmit={save} className="mt-8 space-y-6">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-5">
            <div ref={photoMenuRef} className="relative h-20 w-20 shrink-0">
              <button type="button" onClick={() => setPhotoMenu(x => !x)} className="group relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#001F3F] font-bold text-white">
                {profileImage ? <img src={profileImage} alt="Profile" className="h-full w-full object-cover"/> : initials}
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100">{uploadingImage ? <Loader2 className="animate-spin"/> : <Camera/>}</span>
              </button>
              {photoMenu && <div className="absolute left-0 top-20 z-20 rounded-lg border bg-white p-3 shadow-lg">
                <label className="cursor-pointer whitespace-nowrap text-sm">Upload photo<input type="file" accept="image/*" onChange={uploadImage} className="hidden"/></label>
                {profileImage && <button type="button" onClick={() => { setProfileImage(""); setPhotoMenu(false); }} className="mt-2 block text-sm text-red-600">Remove photo</button>}
              </div>}
            </div>
            <div><h2 className="text-xl font-bold text-[#001F3F]">{`${firstName} ${lastName}`.trim() || "Your Profile"}</h2><p className="mt-1 text-sm text-gray-500">{email}</p></div>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-3 border-b pb-5 text-xl font-bold text-[#001F3F]"><User size={20}/> Personal Information</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-semibold text-gray-700">First Name<input value={firstName} onChange={e => setFirstName(e.target.value)} className={field}/></label>
            <label className="text-sm font-semibold text-gray-700">Last Name<input value={lastName} onChange={e => setLastName(e.target.value)} className={field}/></label>
            <label className="text-sm font-semibold text-gray-700">Email Address<div className="relative"><Mail className="absolute left-3 top-5 text-gray-400" size={17}/><input type="email" readOnly value={email} className={`${field} bg-gray-100 pl-10 text-gray-500`}/></div></label>
            <label className="text-sm font-semibold text-gray-700">Phone Number<div className="relative"><Phone className="absolute left-3 top-5 text-gray-400" size={17}/><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={`${field} pl-10`}/></div></label>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-3 border-b pb-5 text-xl font-bold text-[#001F3F]"><MapPin size={20}/> Location</h2>
          <p className="mt-3 text-sm text-gray-500">General location appears on ToolDrop listings. Your street address is private.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <label className="text-sm font-semibold text-gray-700 md:col-span-2">City<input value={city} onChange={e => setCity(e.target.value)} className={field}/></label>
            <label className="text-sm font-semibold text-gray-700">State<input maxLength={2} value={state} onChange={e => setState(e.target.value.toUpperCase())} className={field}/></label>
            <label className="text-sm font-semibold text-gray-700">ZIP Code<input maxLength={10} value={zipCode} onChange={e => setZipCode(e.target.value)} className={field}/></label>
          </div>
        </section>
        <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-3 border-b pb-5 text-xl font-bold text-[#001F3F]"><Truck size={21}/> ToolDrop Pickup & Drop-off Defaults</h2>
          <p className="mt-3 text-sm text-gray-600">Used to automatically fill new listings. Each tool can have its own custom instructions in My Tools. Your exact street address is never shown on public ToolDrop pages.</p>
          <div className="mt-5 space-y-5">
            <label className="block text-sm font-semibold text-gray-700">Default street address<input value={streetAddress} onChange={e => setStreetAddress(e.target.value)} placeholder="123 Main Street, Apt 2 (optional)" className={field}/></label>
            <p className="-mt-3 text-xs text-gray-500">Your city, state, and ZIP code are added to the pickup address on new listings.</p>
            <label className="block text-sm font-semibold text-gray-700">Default pickup instructions<textarea rows={3} maxLength={1200} value={defaultPickupInstructions} onChange={e => setDefaultPickupInstructions(e.target.value)} placeholder="Please text me when you arrive. I'll meet you in the driveway." className={field}/></label>
            <label className="block text-sm font-semibold text-gray-700">Default drop-off instructions<textarea rows={3} maxLength={1200} value={defaultDropoffInstructions} onChange={e => setDefaultDropoffInstructions(e.target.value)} placeholder="Return the tool clean, with all accessories, and leave it with me." className={field}/></label>
          </div>
        </section>
        <div className="flex justify-end"><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#001F3F] px-6 py-3 font-semibold text-white disabled:opacity-60"><Save size={18}/>{saving ? "Saving..." : "Save Changes"}</button></div>
      </form>
    </div>
  );
}
