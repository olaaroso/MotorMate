"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Save,
  Store,
  Wrench,
  X,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute} ${ampm}`;
});

const COMMON_SERVICES = [
  "Oil Change",
  "Brake Pad Replacement",
  "Tire Rotation",
  "Wheel Alignment",
  "Battery Replacement",
  "Transmission Fluid Exchange",
  "Air Filter Replacement",
  "Spark Plug Replacement",
  "Coolant Flush",
  "Engine Diagnostic",
  "Suspension Repair",
  "Exhaust System Repair",
  "Timing Belt Replacement",
  "Alternator Repair",
  "Starter Replacement",
  "Fuel Pump Replacement",
  "A/C Recharge & Repair",
  "Power Steering Flush",
  "Wiper Blade Replacement",
  "Headlight Bulb Replacement",
  "Check Engine Light Diagnostic",
  "Emissions Testing",
  "Radiator Repair",
  "Drive Belt Replacement",
  "Clutch Repair",
  "Strut & Shock Replacement",
  "Brake Caliper Replacement",
  "Brake Rotor Resurfacing",
  "Tire Mounting & Balancing",
  "Cabin Air Filter Replacement",
];

type OperatingHours = Record<string, string>;

type MechanicProfileResponse = {
  owner_id?: string;
  shop_name?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
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

function parseTimeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})\s(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (hour === 12) hour = 0;
  if (period === "PM") hour += 12;
  return hour * 60 + minute;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function MechanicShopPage() {
  const [shopName, setShopName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [phone, setPhone] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(emptyHours());

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customServiceText, setCustomServiceText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isNewProfile, setIsNewProfile] = useState(true);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsServiceDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to load your shop profile.");
        }

        const result = await response.json();
        const profile: MechanicProfileResponse = result.profile || {};

        setIsNewProfile(false);
        setShopName(profile.shop_name || "");
        setStreetAddress(profile.street_address || profile.address || "");
        setCity(profile.city || "");
        setStateCode(profile.state || "");
        setZipCode(profile.zip_code || "");
        setPhone(profile.phone ? formatPhone(profile.phone) : "");
        setSelectedServices(profile.services_offered || []);
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

  const toggleDay = (day: string) => {
    setOperatingHours((current) => ({
      ...current,
      [day]: current[day] ? "" : "8:00 AM - 5:00 PM",
    }));
  };

  const updateTime = (day: string, type: "open" | "close", value: string) => {
    setOperatingHours((current) => {
      const [open = "8:00 AM", close = "5:00 PM"] = (
        current[day] || "8:00 AM - 5:00 PM"
      ).split(" - ");

      return {
        ...current,
        [day]: type === "open" ? `${value} - ${close}` : `${open} - ${value}`,
      };
    });
  };

  const validateHours = () => {
    for (const day of DAYS) {
      const value = operatingHours[day]?.trim();
      if (!value) continue;

      const [open, close] = value.split(" - ");
      const openMinutes = parseTimeToMinutes(open);
      const closeMinutes = parseTimeToMinutes(close);

      if (
        openMinutes === null ||
        closeMinutes === null ||
        closeMinutes <= openMinutes
      ) {
        return `${DAY_LABELS[day]} closing time must be later than opening time.`;
      }
    }

    return "";
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      setError("You must be signed in to update your shop profile.");
      return;
    }

    if (
      !shopName.trim() ||
      !streetAddress.trim() ||
      !city.trim() ||
      !stateCode.trim() ||
      !zipCode.trim()
    ) {
      setError("Shop name, street address, city, state, and ZIP code are required.");
      return;
    }

    if (!/^[A-Za-z]{2}$/.test(stateCode.trim())) {
      setError("State must be a 2-letter abbreviation, such as NY.");
      return;
    }

    if (!/^\d{5}$/.test(zipCode.trim())) {
      setError("ZIP code must contain exactly 5 digits.");
      return;
    }

    const hoursError = validateHours();
    if (hoursError) {
      setError(hoursError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSaved(false);

      const trimmedHours = Object.fromEntries(
        Object.entries(operatingHours).filter(([, value]) => String(value).trim())
      );

      const payload = {
        owner_id: user.uid,
        shop_name: shopName.trim(),
        street_address: streetAddress.trim(),
        city: city.trim(),
        state: stateCode.trim().toUpperCase(),
        zip_code: zipCode.trim(),
        phone: phone.trim() || null,
        services_offered: selectedServices,
        price_per_hour: pricePerHour ? Number(pricePerHour) : null,
        operating_hours: Object.keys(trimmedHours).length ? trimmedHours : null,
      };

      const response = await fetch(`${apiUrl}/api/mechanics/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || "Something went wrong while saving your shop profile.");
      }

      setIsNewProfile(false);
      setSaved(true);
      window.dispatchEvent(
        new CustomEvent("shopProfileUpdated", { detail: shopName.trim() })
      );
      window.setTimeout(() => setSaved(false), 2500);
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
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          My Shop
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#001F3F] sm:text-4xl">
          {isNewProfile ? "Create Your Shop Profile" : "Edit Shop Profile"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          This is what customers will see when they search for mechanics near them.
        </p>
      </section>

      {saved && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={18} />
          Shop profile saved.
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Store size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">Shop Information</h2>
              <p className="text-sm text-slate-500">
                Your business name, contact information, and location.
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
                onChange={(event) => setShopName(event.target.value)}
                placeholder="e.g. Jason's Auto Repair"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">
                Street Address
              </label>
              <div className="relative mt-2">
                <MapPin
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(event) => setStreetAddress(event.target.value)}
                  placeholder="2350 NY-110"
                  required
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">City</label>
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Farmingdale"
                required
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              />
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-700">State</label>
                <input
                  type="text"
                  value={stateCode}
                  onChange={(event) =>
                    setStateCode(
                      event.target.value.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase()
                    )
                  }
                  placeholder="NY"
                  maxLength={2}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">ZIP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={zipCode}
                  onChange={(event) =>
                    setZipCode(event.target.value.replace(/\D/g, "").slice(0, 5))
                  }
                  placeholder="11735"
                  maxLength={5}
                  required
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Phone Number</label>
              <div className="relative mt-2">
                <Phone
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(formatPhone(event.target.value))}
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
                  onChange={(event) => setPricePerHour(event.target.value)}
                  placeholder="110"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <style>{`
            @keyframes badgeShake {
              0%, 100% { transform: translateX(0) rotate(0deg); }
              25% { transform: translateX(-2.5px) rotate(-2.5deg); }
              75% { transform: translateX(2.5px) rotate(2.5deg); }
            }
            .group:hover .badge-shake {
              animation: badgeShake 0.25s ease-in-out infinite;
            }
          `}</style>

          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">Services Offered</h2>
              <p className="text-sm text-slate-500">
                Select the work your shop performs so customers can find the right mechanic.
              </p>
            </div>
          </div>

          <div className="relative mt-6" ref={dropdownRef}>
            <div className="flex min-h-13 w-full flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-[#001F3F] focus-within:ring-1 focus-within:ring-[#001F3F]">
              {selectedServices.map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() =>
                    setSelectedServices((current) =>
                      current.filter((item) => item !== service)
                    )
                  }
                  className="group flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-[#001F3F] shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <span className="badge-shake">{service}</span>
                  <X size={14} className="badge-shake opacity-50 transition-opacity group-hover:opacity-100" />
                </button>
              ))}

              <input
                type="text"
                value={serviceSearch}
                onChange={(event) => setServiceSearch(event.target.value)}
                onFocus={() => setIsServiceDropdownOpen(true)}
                placeholder={
                  selectedServices.length === 0
                    ? "Search services, e.g. brakes or oil change..."
                    : "Add another service..."
                }
                className="min-w-45 flex-1 bg-transparent px-2 py-1 text-sm text-slate-700 outline-none"
              />
            </div>

            {isServiceDropdownOpen && (
              <div className="absolute left-0 top-full z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {COMMON_SERVICES.filter(
                  (service) =>
                    service.toLowerCase().includes(serviceSearch.toLowerCase()) &&
                    !selectedServices.includes(service)
                ).map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => {
                      setSelectedServices((current) => [...current, service]);
                      setServiceSearch("");
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    {service}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setIsServiceDropdownOpen(false);
                    setShowCustomModal(true);
                  }}
                  className="w-full border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-left text-sm font-semibold text-[#001F3F] transition-colors hover:bg-slate-100"
                >
                  + Add Custom Service
                </button>
              </div>
            )}
          </div>
        </section>

        {showCustomModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-xl font-bold text-[#001F3F]">Add Custom Service</h3>
              <p className="mt-1 text-sm text-slate-500">
                Add a repair or maintenance service not already listed.
              </p>
              <input
                autoFocus
                type="text"
                value={customServiceText}
                onChange={(event) => setCustomServiceText(event.target.value)}
                placeholder="e.g. Classic Car Inspection"
                className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomModal(false);
                    setCustomServiceText("");
                  }}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const customService = customServiceText.trim();
                    if (customService && !selectedServices.includes(customService)) {
                      setSelectedServices((current) => [...current, customService]);
                    }
                    setCustomServiceText("");
                    setShowCustomModal(false);
                    setServiceSearch("");
                  }}
                  className="rounded-xl bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#003366]"
                >
                  Add Service
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">Operating Hours</h2>
              <p className="text-sm text-slate-500">
                Choose the days your shop is open and set normal business hours.
                Customers can request 30-minute appointments during these times.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {DAYS.map((day) => {
              const isOpen = !!operatingHours[day];
              const [openTime = "8:00 AM", closeTime = "5:00 PM"] = (
                operatingHours[day] || ""
              ).split(" - ");

              return (
                <div key={day} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-sm font-semibold text-slate-700">
                      {DAY_LABELS[day]}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={() => toggleDay(day)}
                        className="h-4 w-4 cursor-pointer accent-[#001F3F]"
                      />
                      <span className="w-10 text-right text-xs font-medium text-slate-500">
                        {isOpen ? "Open" : "Closed"}
                      </span>
                    </label>
                  </div>

                  {isOpen ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={openTime.trim()}
                        onChange={(event) => updateTime(day, "open", event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                      <span className="text-xs font-medium text-slate-400">to</span>
                      <select
                        value={closeTime.trim()}
                        onChange={(event) => updateTime(day, "close", event.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                      >
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex h-10.5 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                      <span className="text-sm italic text-slate-400">
                        Closed on {DAY_LABELS[day]}s
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

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
