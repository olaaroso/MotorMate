"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Save,
  User,
} from "lucide-react";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export default function AccountSettingsPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Email comes directly from Firebase Authentication
        setEmail(user.email || "");

        // Extra MotorMate profile information comes from Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          const data = userSnapshot.data();

          setPhone(data.phone || "");
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
          setCity(data.city || "");
          setState(data.state || "");
          setZipCode(data.zipCode || "");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
        setError("Unable to load your account information.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      setError("You must be signed in to update your profile.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSaved(false);

      await setDoc(
        doc(db, "users", user.uid),
        {
          email: user.email,
          phone,
          firstName,
          lastName,
          city,
          state,
          zipCode,
        },
        {
          merge: true,
        }
      );

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Something went wrong while saving your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <p className="text-gray-500">Loading account...</p>
      </div>
    );
  }

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "?";

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* HEADER */}

      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          Account
        </p>

        <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">
          Account Settings
        </h1>

        <p className="mt-2 text-gray-500">
          Manage your personal information and MotorMate profile.
        </p>
      </section>

      {/* SUCCESS */}

      {saved && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          Profile changes saved.
        </div>
      )}

      {/* ERROR */}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* PROFILE SUMMARY */}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#001F3F] text-xl font-bold text-white">
              {initials}
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">
                {firstName || lastName
                  ? `${firstName} ${lastName}`.trim()
                  : "Your Profile"}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {email}
              </p>
            </div>
          </div>
        </section>

        {/* PERSONAL INFORMATION */}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <User size={20} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">
                Personal Information
              </h2>

              <p className="text-sm text-gray-500">
                Update your basic account details.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {/* FIRST NAME */}

            <div>
              <label className="text-sm font-semibold text-gray-700">
                First Name
              </label>

              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              />
            </div>

            {/* LAST NAME */}

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Last Name
              </label>

              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              />
            </div>

            {/* EMAIL */}

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Email Address
              </label>

              <div className="relative mt-2">
                <Mail
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-gray-300 bg-gray-100 py-3 pl-11 pr-4 text-gray-500 outline-none"
                />
              </div>

              <p className="mt-1 text-xs text-gray-400">
                Email is tied to your signed-in Firebase account.
              </p>
            </div>

            {/* PHONE */}

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Phone Number
              </label>

              <div className="relative mt-2">
                <Phone
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* LOCATION */}

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <MapPin size={20} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">
                Location
              </h2>

              <p className="text-sm text-gray-500">
                Used for nearby mechanics and ToolDrop listings.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">
                City
              </label>

              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Enter city"
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#001F3F]"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                State
              </label>

              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="NY"
                maxLength={2}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 uppercase outline-none focus:border-[#001F3F]"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                ZIP Code
              </label>

              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Enter ZIP code"
                maxLength={10}
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#001F3F]"
              />
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-[#001F3F]">
              MotorMate can use your general location for nearby mechanics and
              ToolDrop rentals. Your exact home address does not need to be
              displayed publicly.
            </p>
          </div>
        </section>

        {/* SAVE BUTTON */}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[#001F3F] px-6 py-3 font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={18} />

            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}