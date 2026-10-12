"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Save,
  Store,
  Wrench,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

type OperatingHours = Record<string, string>;

type MechanicProfileResponse = {
  owner_id?: string;
  shop_name?: string;
  address?: string;
  phone?: string;
  services_offered?: string[];
  price_per_hour?: number;
  operating_hours?: OperatingHours;
};

function emptyHours(): OperatingHours {
  return DAYS.reduce((acc, day) => {
    acc[day] = "";
    return acc;
  }, {} as OperatingHours);
}

export default function MechanicShopPage() {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [servicesInput, setServicesInput] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");
  const [operatingHours, setOperatingHours] =
    useState<OperatingHours>(emptyHours());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isNewProfile, setIsNewProfile] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/api/mechanics/${user.uid}`);

        if (response.status === 404) {
          setIsNewProfile(true);
          setLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load your shop profile.");
        }

        const result = await response.json();
        const profile: MechanicProfileResponse = result.profile || {};

        setIsNewProfile(false);
        setShopName(profile.shop_name || "");
        setAddress(profile.address || "");
        setPhone(profile.phone || "");
        setServicesInput((profile.services_offered || []).join(", "));
        setPricePerHour(
          profile.price_per_hour !== undefined && profile.price_per_hour !== null
            ? String(profile.price_per_hour)
            : ""
        );
        setOperatingHours({
          ...emptyHours(),
          ...(profile.operating_hours || {}),
        });
      } catch (err) {
        console.error("Failed to load shop profile:", err);
        setError("Unable to load your shop profile.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      setError("You must be signed in to update your shop profile.");
      return;
    }

    if (!shopName.trim() || !address.trim()) {
      setError("Shop name and address are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSaved(false);

      const servicesOffered = servicesInput
        .split(",")
        .map((service) => service.trim())
        .filter(Boolean);

      const trimmedHours = Object.fromEntries(
        Object.entries(operatingHours).filter(([, value]) => value.trim())
      );

      const payload = {
        owner_id: user.uid,
        shop_name: shopName.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        services_offered: servicesOffered,
        price_per_hour: pricePerHour ? Number(pricePerHour) : null,
        operating_hours: Object.keys(trimmedHours).length
          ? trimmedHours
          : null,
      };

      const response = await fetch(`${apiUrl}/api/mechanics/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || "Something went wrong while saving your shop profile."
        );
      }

      setIsNewProfile(false);
      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2500);
    } catch (err) {
      console.error("Failed to save shop profile:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while saving your shop profile."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-9">
        <p className="text-gray-500">Loading your shop profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-9">
      {/* HEADER */}
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          My Shop
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#001F3F] sm:text-4xl">
          {isNewProfile ? "Create Your Shop Profile" : "Edit Shop Profile"}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          This is what customers will see when they search for mechanics
          near them.
        </p>
      </section>

      {/* SUCCESS */}
      {saved && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          Shop profile saved.
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* SHOP INFO */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Store size={20} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">
                Shop Information
              </h2>
              <p className="text-sm text-slate-500">
                Your business name and location.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">
                Shop / Business Name
              </label>

              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Jason's Auto Repair"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">
                Address
              </label>

              <div className="relative mt-2">
                <MapPin
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, Farmingdale, NY 11735"
                  required
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Phone Number
              </label>

              <div className="relative mt-2">
                <Phone
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Labor Rate ($/hr)
              </label>

              <div className="relative mt-2">
                <DollarSign
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={pricePerHour}
                  onChange={(e) => setPricePerHour(e.target.value)}
                  placeholder="110"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Wrench size={20} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">
                Services Offered
              </h2>
              <p className="text-sm text-slate-500">
                Separate each service with a comma.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <input
              type="text"
              value={servicesInput}
              onChange={(e) => setServicesInput(e.target.value)}
              placeholder="Brakes, Oil Change, Tires, Diagnostics"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
            />
          </div>
        </section>

        {/* OPERATING HOURS */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Clock size={20} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">
                Operating Hours
              </h2>
              <p className="text-sm text-slate-500">
                Leave a day blank if you&apos;re closed or hours vary.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {DAYS.map((day) => (
              <div key={day}>
                <label className="text-sm font-semibold text-slate-700">
                  {DAY_LABELS[day]}
                </label>

                <input
                  type="text"
                  value={operatingHours[day] ?? ""}
                  onChange={(e) =>
                    setOperatingHours((prev) => ({
                      ...prev,
                      [day]: e.target.value,
                    }))
                  }
                  placeholder="8:00 AM - 5:00 PM"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>
            ))}
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
            {saving ? "Saving..." : "Save Shop Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
