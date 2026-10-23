"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import {
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Phone,
  Save,
  Store,
  Wrench,
  X
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import AppointmentAvailability from "@/components/AppointmentAvailability";

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
  "Oil Change", "Brake Pad Replacement", "Tire Rotation", "Wheel Alignment",
  "Battery Replacement", "Transmission Fluid Exchange", "Air Filter Replacement",
  "Spark Plug Replacement", "Coolant Flush", "Engine Diagnostic",
  "Suspension Repair", "Exhaust System Repair", "Timing Belt Replacement",
  "Alternator Repair", "Starter Replacement", "Fuel Pump Replacement",
  "A/C Recharge & Repair", "Power Steering Flush", "Wiper Blade Replacement",
  "Headlight Bulb Replacement", "Check Engine Light Diagnostic", "Emissions Testing",
  "Radiator Repair", "Drive Belt Replacement", "Clutch Repair",
  "Strut & Shock Replacement", "Brake Caliper Replacement", "Brake Rotor Resurfacing",
  "Tire Mounting & Balancing", "Cabin Air Filter Replacement"
];

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
  const [ownerId, setOwnerId] = useState("");

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
        setOwnerId("");
        setLoading(false);
        return;
      }

      setOwnerId(user.uid);

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
    setOperatingHours((prev) => {
      const isOpen = !!prev[day];
      return {
        ...prev,
        [day]: isOpen ? "" : "8:00 AM - 5:00 PM",
      };
    });
  };

  const updateTime = (day: string, type: "open" | "close", value: string) => {
    setOperatingHours((prev) => {
      const current = prev[day] || "8:00 AM - 5:00 PM";
      const [open = "8:00 AM", close = "5:00 PM"] = current.split(" - ");

      if (type === "open") {
        return { ...prev, [day]: `${value} - ${close}` };
      } else {
        return { ...prev, [day]: `${open} - ${value}` };
      }
    });
  };

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

      const trimmedHours = Object.fromEntries(
          Object.entries(operatingHours).filter(([, value]) => value.trim())
      );

      const payload = {
        owner_id: user.uid,
        shop_name: shopName.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        services_offered: selectedServices,
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

      window.dispatchEvent(new CustomEvent("shopProfileUpdated", { detail: shopName.trim() }));

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
            This is what customers will see when they search for mechanics near them.
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
            {/* Custom Shake Animation */}
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
                <p className="text-sm text-slate-500">Search and select services or add your own.</p>
              </div>
            </div>

            <div className="relative mt-6" ref={dropdownRef}>
              {/* Dynamic Expanding Text Box */}
              <div className="flex min-h-[52px] w-full flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-[#001F3F] focus-within:ring-1 focus-within:ring-[#001F3F]">

                {selectedServices.map((service) => (
                    <div
                        key={service}
                        onClick={() => setSelectedServices((prev) => prev.filter((s) => s !== service))}
                        className="group flex cursor-pointer items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-[#001F3F] shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <span className="badge-shake">{service}</span>
                      <X size={14} className="badge-shake opacity-50 transition-opacity group-hover:opacity-100" />
                    </div>
                ))}

                <input
                    type="text"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    onFocus={() => setIsServiceDropdownOpen(true)}
                    placeholder={selectedServices.length === 0 ? "Search for services (e.g. Brakes)..." : ""}
                    className="min-w-[150px] flex-1 bg-transparent px-2 py-1 text-sm text-slate-700 outline-none"
                />
              </div>

              {/* Dropdown Menu */}
              {isServiceDropdownOpen && (
                  <div className="absolute left-0 top-full z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {COMMON_SERVICES.filter(
                        (s) => s.toLowerCase().includes(serviceSearch.toLowerCase()) && !selectedServices.includes(s)
                    ).map((service) => (
                        <button
                            key={service}
                            type="button"
                            onClick={() => {
                              setSelectedServices((prev) => [...prev, service]);
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

          {/* Custom Service Modal */}
          {showCustomModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                  <h3 className="text-xl font-bold text-[#001F3F]">Add Custom Service</h3>
                  <p className="mt-1 text-sm text-slate-500">Enter the description for your unique service.</p>

                  <input
                      autoFocus
                      type="text"
                      value={customServiceText}
                      onChange={(e) => setCustomServiceText(e.target.value)}
                      placeholder="e.g. Custom Neon Underglow"
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
                          if (customServiceText.trim() && !selectedServices.includes(customServiceText.trim())) {
                            setSelectedServices((prev) => [...prev, customServiceText.trim()]);
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

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {DAYS.map((day) => {
                const isOpen = !!operatingHours[day];
                const [openTime = "8:00 AM", closeTime = "5:00 PM"] = (
                    operatingHours[day] || ""
                ).split(" - ");

                return (
                    <div key={day} className="flex flex-col gap-2">
                      {/* HEADER & CHECKBOX */}
                      <div className="flex items-center justify-between px-1">
                        <label className="text-sm font-semibold capitalize text-slate-700">
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

                      {/* DROPDOWNS OR CLOSED STATE */}
                      {isOpen ? (
                          <div className="flex items-center gap-2">
                            <select
                                value={openTime.trim()}
                                onChange={(e) => updateTime(day, "open", e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                            >
                              {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                              ))}
                            </select>

                            <span className="text-xs font-medium text-slate-400">to</span>

                            <select
                                value={closeTime.trim()}
                                onChange={(e) => updateTime(day, "close", e.target.value)}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                            >
                              {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                      ) : (
                          <div className="flex h-[42px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
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

        {/* APPOINTMENT AVAILABILITY (saves independently of the form above) */}
        {ownerId && (
            <div className="mt-6">
              <AppointmentAvailability ownerId={ownerId} />
            </div>
        )}
      </div>
  );
}