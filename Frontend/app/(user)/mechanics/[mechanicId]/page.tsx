"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  Phone,
  Send,
  Star,
  Store,
  Wrench,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const OTHER_SERVICE = "Other / Not sure";

type MechanicProfile = {
  owner_id: string;
  shop_name?: string;
  address?: string;
  phone?: string | null;
  services_offered?: string[];
  price_per_hour?: number | null;
  operating_hours?: Record<string, string> | null;
  rating?: number;
};

type AppointmentWindow = {
  start: string; // "HH:MM" (24-hour)
  end: string; // "HH:MM" (24-hour)
};

type DayWindows = {
  open: boolean;
  hours: string | null;
  windows: AppointmentWindow[];
};

type RawVehicle = {
  _id?: string;
  id?: string;
  make?: string;
  Make?: string;
  model?: string;
  Model?: string;
  year?: number | string;
  ModelYear?: number | string;
  current_mileage?: number | string;
};

type GarageVehicle = {
  id: string;
  label: string;
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function getLocalToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function splitTime(time: string) {
  const [hourText, minute = "00"] = time.split(":");
  const hour = Number(hourText);
  const ampm = hour < 12 ? "AM" : "PM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return { clock: `${displayHour}:${minute}`, ampm };
}

function formatWindow({ start, end }: AppointmentWindow) {
  const from = splitTime(start);
  const to = splitTime(end);
  return from.ampm === to.ampm
    ? `${from.clock} – ${to.clock} ${to.ampm}`
    : `${from.clock} ${from.ampm} – ${to.clock} ${to.ampm}`;
}

function formatLongDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function groupHours(hours?: Record<string, string> | null) {
  if (!hours || !DAYS.some((day) => hours[day]?.trim())) return [];

  const groups: { start: string; end: string; time: string }[] = [];

  for (const day of DAYS) {
    const time = hours[day]?.trim() || "Closed";
    const last = groups[groups.length - 1];

    if (last && last.time === time) {
      last.end = day;
    } else {
      groups.push({ start: day, end: day, time });
    }
  }

  return groups;
}

function toGarageVehicle(raw: RawVehicle): GarageVehicle | null {
  const id = raw._id || raw.id;
  if (!id) return null;

  const year = raw.year || raw.ModelYear || "";
  const make = raw.make || raw.Make || "";
  const model = raw.model || raw.Model || "";
  const mileage = Number(raw.current_mileage) || 0;

  const name = [year, make, model].filter(Boolean).join(" ") || "Vehicle";

  return {
    id,
    label: mileage ? `${name} · ${mileage.toLocaleString()} mi` : name,
  };
}

async function fetchWindows(mechanicId: string, date: string): Promise<DayWindows> {
  const response = await fetch(
    `${apiUrl}/api/mechanics/${encodeURIComponent(mechanicId)}/appointment-windows?date=${date}`
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "Failed to load appointment times.");
  }

  return {
    open: !!data.open,
    hours: data.hours ?? null,
    windows: data.windows || [],
  };
}

export default function MechanicDetailPage() {
  const params = useParams();
  const mechanicId = decodeURIComponent(String(params.mechanicId || ""));

  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [currentUserId, setCurrentUserId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [authLoading, setAuthLoading] = useState(true);

  const [appointmentDate, setAppointmentDate] = useState("");
  const [dayWindows, setDayWindows] = useState<DayWindows | null>(null);
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [windowsError, setWindowsError] = useState("");
  const [windowsRefresh, setWindowsRefresh] = useState(0);
  const [selectedStart, setSelectedStart] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [serviceRequested, setServiceRequested] = useState("");
  const [problemDescription, setProblemDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Shop profile
  useEffect(() => {
    if (!mechanicId) return;

    let cancelled = false;

    (async () => {
      try {
        const profileResponse = await fetch(
          `${apiUrl}/api/mechanics/${encodeURIComponent(mechanicId)}`
        );
        const profileData = await profileResponse.json().catch(() => ({}));

        if (!profileResponse.ok) {
          throw new Error(
            profileResponse.status === 404
              ? "This shop could not be found."
              : profileData.detail || "Failed to load this shop."
          );
        }

        if (!cancelled) setProfile(profileData.profile);
      } catch (err) {
        console.error("Failed to load mechanic:", err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load this shop.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mechanicId]);

  // Generated 30-minute windows for the chosen date
  useEffect(() => {
    if (!mechanicId || !appointmentDate) return;

    let cancelled = false;

    (async () => {
      try {
        setWindowsLoading(true);
        setWindowsError("");

        const result = await fetchWindows(mechanicId, appointmentDate);

        if (!cancelled) {
          setDayWindows(result);
          setSelectedStart((current) =>
            result.windows.some((window) => window.start === current) ? current : ""
          );
        }
      } catch (err) {
        console.error("Failed to load appointment windows:", err);
        if (!cancelled) {
          setDayWindows(null);
          setSelectedStart("");
          setWindowsError(
            err instanceof Error ? err.message : "Failed to load appointment times."
          );
        }
      } finally {
        if (!cancelled) setWindowsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mechanicId, appointmentDate, windowsRefresh]);

  // Signed-in customer: name (Firestore) + saved vehicles (Garage API)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUserId("");
        setCustomerName("");
        setVehicles([]);
        setAuthLoading(false);
        return;
      }

      setCurrentUserId(user.uid);

      try {
        const [snapshot, vehiclesResponse] = await Promise.all([
          getDoc(doc(db, "users", user.uid)).catch(() => null),
          fetch(`${apiUrl}/api/vin/vehicles/${user.uid}`),
        ]);

        const userData = snapshot?.exists() ? snapshot.data() : {};
        setCustomerName(
          `${userData.firstName || ""} ${userData.lastName || ""}`.trim()
        );

        const vehiclesData = await vehiclesResponse.json().catch(() => ({}));

        if (!vehiclesResponse.ok) {
          throw new Error(vehiclesData.detail || "Failed to load your vehicles.");
        }

        const garage = ((vehiclesData.vehicles || []) as RawVehicle[])
          .map(toGarageVehicle)
          .filter((vehicle): vehicle is GarageVehicle => vehicle !== null);

        setVehicles(garage);
        setSelectedVehicleId((current) =>
          current || (garage.length === 1 ? garage[0].id : "")
        );
      } catch (err) {
        console.error("Failed to load customer details:", err);
        setSubmitError(
          err instanceof Error ? err.message : "Failed to load your vehicles."
        );
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isOwnShop = !!currentUserId && currentUserId === mechanicId;
  const services = profile?.services_offered || [];
  const hours = groupHours(profile?.operating_hours);
  const acceptsRequests = hours.length > 0;
  const selectedWindow =
    dayWindows?.windows.find((window) => window.start === selectedStart) || null;

  const handleSubmit = async () => {
    setSubmitError("");

    if (!currentUserId) {
      setSubmitError("You must be signed in to request an appointment.");
      return;
    }

    if (!customerName) {
      setSubmitError(
        "Add your first and last name in Account Settings before requesting an appointment."
      );
      return;
    }

    if (!appointmentDate || !selectedWindow) {
      setSubmitError("Choose an appointment date and time.");
      return;
    }

    if (!selectedVehicleId) {
      setSubmitError("Choose the vehicle that needs service.");
      return;
    }

    if (!serviceRequested) {
      setSubmitError("Choose the service you need.");
      return;
    }

    if (problemDescription.trim().length < 10) {
      setSubmitError("Describe the problem in at least 10 characters.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`${apiUrl}/api/service-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mechanic_id: mechanicId,
          appointment_date: appointmentDate,
          appointment_start_time: selectedWindow.start,
          customer_id: currentUserId,
          customer_name: customerName,
          vehicle_id: selectedVehicleId,
          service_requested: serviceRequested,
          problem_description: problemDescription.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Hours may have changed or the time may have passed; refresh.
        if (response.status === 400 || response.status === 409) {
          setWindowsRefresh((count) => count + 1);
        }

        throw new Error(data.detail || "Unable to submit your request.");
      }

      setSubmitSuccess(true);
    } catch (err) {
      console.error("Service request failed:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Unable to submit your request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[500px] max-w-7xl items-center justify-center p-8 text-gray-500">
        <Loader2 size={24} className="mr-3 animate-spin" />
        Loading shop...
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <BackLink />
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-xl font-bold text-red-800">Shop unavailable</h1>
          <p className="mt-2 text-sm text-red-700">
            {loadError || "This shop could not be found."}
          </p>
        </div>
      </div>
    );
  }

  const laborRate =
    profile.price_per_hour !== undefined && profile.price_per_hour !== null
      ? `$${profile.price_per_hour}/hr`
      : "Rate not listed";

  const formDisabled = submitting || submitSuccess;

  return (
    <div className="mx-auto max-w-7xl p-8">
      <BackLink />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        {/* SHOP DETAILS */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
                  <Store size={26} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                    Repair Shop
                  </p>
                  <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">
                    {profile.shop_name || "Unnamed Shop"}
                  </h1>

                  <div className="mt-3 space-y-1.5 text-sm text-slate-500">
                    {profile.address && (
                      <p className="flex items-start gap-2">
                        <MapPin size={16} className="mt-0.5 shrink-0" />
                        {profile.address}
                      </p>
                    )}
                    {profile.phone && (
                      <p className="flex items-center gap-2">
                        <Phone size={16} className="shrink-0" />
                        {profile.phone}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {typeof profile.rating === "number" && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  {profile.rating.toFixed(1)}
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <DollarSign size={14} />
                  Labor Rate
                </p>
                <p className="mt-1 text-lg font-bold text-slate-800">{laborRate}</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Clock size={14} />
                  Hours
                </p>
                {hours.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">Hours not listed</p>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {hours.map((group) => (
                      <div key={group.start} className="flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-700">
                          {group.start === group.end
                            ? DAY_LABELS[group.start]
                            : `${DAY_LABELS[group.start]} – ${DAY_LABELS[group.end]}`}
                        </span>
                        <span
                          className={
                            group.time === "Closed" ? "italic text-slate-400" : "text-slate-500"
                          }
                        >
                          {group.time}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#001F3F]">
              <Wrench size={18} />
              Services Offered
            </h2>

            {services.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No services listed.</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {services.map((service) => (
                  <span
                    key={service}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-[#001F3F]"
                  >
                    {service}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* REQUEST PANEL */}
        <aside>
          <section className="sticky top-28 rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h2 className="text-xl font-bold text-[#001F3F]">Request an Appointment</h2>
            <p className="mt-1 text-sm text-slate-500">
              The shop reviews your request before the appointment is confirmed.
            </p>

            {isOwnShop && (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-[#001F3F]">This is your shop</p>
                <p className="mt-1">You can&apos;t request an appointment at your own shop.</p>
              </div>
            )}

            {submitSuccess && selectedWindow && (
              <div className="mt-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Request sent</p>
                  <p className="mt-1 text-sm">
                    {formatLongDate(appointmentDate)} • {formatWindow(selectedWindow)}.
                    Status: <span className="font-semibold">Pending</span> until the shop responds.
                  </p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {submitError}
                {!authLoading && currentUserId && !customerName && (
                  <div className="mt-2">
                    <Link href="/account" className="font-semibold underline">
                      Open Account Settings
                    </Link>
                  </div>
                )}
              </div>
            )}

            {!isOwnShop && !acceptsRequests && (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-500">
                This shop hasn&apos;t listed its operating hours, so it isn&apos;t
                accepting online appointment requests yet.
              </div>
            )}

            {!isOwnShop && acceptsRequests && (
              <div className="mt-6 space-y-6">
                {/* DATE + TIME */}
                <div>
                  <label
                    htmlFor="appointment-date"
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >
                    <CalendarDays size={16} className="text-[#001F3F]" />
                    Appointment Date
                  </label>
                  <input
                    id="appointment-date"
                    type="date"
                    min={getLocalToday()}
                    value={appointmentDate}
                    onChange={(e) => {
                      setAppointmentDate(e.target.value);
                      setSelectedStart("");
                      setDayWindows(null);
                      setSubmitError("");
                    }}
                    disabled={formDisabled}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] disabled:bg-slate-50"
                  />

                  {appointmentDate && (
                    <div className="mt-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Clock size={16} className="text-[#001F3F]" />
                        Appointment Time
                        <span className="font-normal text-slate-400">(30 min)</span>
                      </p>

                      {windowsLoading ? (
                        <p className="mt-3 flex items-center text-sm text-slate-400">
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Loading times...
                        </p>
                      ) : windowsError ? (
                        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {windowsError}
                        </p>
                      ) : dayWindows && !dayWindows.open ? (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center text-sm text-slate-500">
                          The shop is closed on {formatLongDate(appointmentDate)}. Pick another day.
                        </p>
                      ) : dayWindows && dayWindows.windows.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center text-sm text-slate-500">
                          No times left on this day. Pick another day.
                        </p>
                      ) : dayWindows ? (
                        <>
                          <p className="mt-1 text-xs text-slate-400">
                            Shop hours: {dayWindows.hours}
                          </p>
                          <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-1">
                            {dayWindows.windows.map((window) => {
                              const selected = window.start === selectedStart;
                              return (
                                <button
                                  key={window.start}
                                  type="button"
                                  disabled={formDisabled}
                                  onClick={() => {
                                    setSelectedStart(window.start);
                                    setSubmitError("");
                                  }}
                                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${
                                    selected
                                      ? "border-[#001F3F] bg-[#001F3F] text-white"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-[#001F3F] hover:bg-blue-50"
                                  }`}
                                >
                                  {formatWindow(window)}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* VEHICLE */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Car size={16} className="text-[#001F3F]" />
                    Vehicle
                  </label>

                  {authLoading ? (
                    <p className="mt-2 text-sm text-slate-400">Loading your vehicles...</p>
                  ) : !currentUserId ? (
                    <p className="mt-2 text-sm text-slate-500">Sign in to choose a vehicle.</p>
                  ) : vehicles.length === 0 ? (
                    <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-500">
                      You don&apos;t have any saved vehicles.{" "}
                      <Link href="/garage" className="font-semibold text-[#001F3F] underline">
                        Add one in My Garage
                      </Link>
                    </div>
                  ) : (
                    <select
                      value={selectedVehicleId}
                      onChange={(e) => setSelectedVehicleId(e.target.value)}
                      disabled={formDisabled}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] disabled:bg-slate-50"
                    >
                      <option value="">Select a vehicle</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* SERVICE */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Wrench size={16} className="text-[#001F3F]" />
                    Service Needed
                  </label>
                  <select
                    value={serviceRequested}
                    onChange={(e) => setServiceRequested(e.target.value)}
                    disabled={formDisabled}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] disabled:bg-slate-50"
                  >
                    <option value="">Select a service</option>
                    {services.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                    <option value={OTHER_SERVICE}>{OTHER_SERVICE}</option>
                  </select>
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Describe the problem
                  </label>
                  <textarea
                    rows={4}
                    maxLength={1000}
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    disabled={formDisabled}
                    placeholder="e.g. Grinding noise from the front wheels when braking."
                    className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] disabled:bg-slate-50"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">
                    {problemDescription.length}/1000
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    formDisabled ||
                    authLoading ||
                    !selectedWindow ||
                    !selectedVehicleId ||
                    !serviceRequested ||
                    problemDescription.trim().length < 10
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] py-3.5 font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Sending Request...
                    </>
                  ) : submitSuccess ? (
                    <>
                      <CheckCircle2 size={18} />
                      Request Sent
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      Submit Request
                    </>
                  )}
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/mechanics"
      className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[#001F3F]"
    >
      <ArrowLeft size={17} />
      Back to Find Mechanics
    </Link>
  );
}
