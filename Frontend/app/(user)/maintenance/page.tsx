"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
    AlertTriangle,
    Car,
    CheckCircle,
    ChevronLeft,
    Info,
    Loader2,
    Settings2,
    X,
    Wrench,
    Plus,
    ThermometerSnowflake,
    MapPin,
    Activity,
    CloudRain,
    ShieldAlert,
    ArrowRight
} from "lucide-react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { createCarImage } from "@/lib/carImage";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface PredictionItem {
    part: string;
    probability: number;
    estimated_cost: number;
}

interface ApiVehicle {
    _id?: string;
    id?: string;
    vin?: string | null;
    make?: string;
    model?: string;
    year?: string | number;
    current_mileage?: number | string;
    climate_condition?: string;
    primary_usage?: string;
    has_in_depth_data?: boolean;
}

interface VehicleDetails {
    make: string;
    model: string;
    year: string;
    mileage: number;
    climate: string;
    usage: string;
}

interface RecallItem {
    ReportReceivedDate: string;
    Component: string;
    Summary: string;
    Consequence: string;
    Remedy: string;
}

function getProTip(part: string) {
    const lowerPart = part.toLowerCase();
    if (lowerPart.includes("battery")) return "Car batteries typically last 3-5 years. Extreme heat or cold can shorten this lifespan significantly.";
    if (lowerPart.includes("brake")) return "Listen for squeaking or grinding. Heavy stop-and-go city driving accelerates brake pad wear.";
    if (lowerPart.includes("oil")) return "Regular oil changes are the cheapest insurance for your engine. Check your dipstick monthly.";
    if (lowerPart.includes("tire")) return "Rotate your tires every 5,000 to 8,000 miles to ensure even wear and maximize their lifespan.";
    if (lowerPart.includes("filter")) return "A clogged air filter reduces fuel efficiency. It's an easy and cheap DIY replacement.";
    if (lowerPart.includes("alternator")) return "A failing alternator will drain your battery. Watch for dimming headlights or a dashboard battery warning light.";
    if (lowerPart.includes("spark")) return "Worn spark plugs cause engine misfires and poor fuel economy. Replacing them restores lost engine power.";
    if (lowerPart.includes("transmission")) return "Old transmission fluid causes rough shifting. A flush and fill can significantly extend the life of your gearbox.";
    if (lowerPart.includes("suspension")) return "Worn struts increase braking distance and tire wear. If your car bounces over bumps, it's time for an inspection.";
    return "Catching this early prevents secondary damage to surrounding components and saves you money in the long run.";
}

function MaintenanceHubContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const vehicleId = searchParams.get("vehicle");
    const autoOpenModal = searchParams.get("open") === "true";

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [predictions, setPredictions] = useState<PredictionItem[]>([]);
    const [garageVehicles, setGarageVehicles] = useState<ApiVehicle[]>([]);
    const [vehicleDetails, setVehicleDetails] = useState<VehicleDetails | null>(null);
    const [recalls, setRecalls] = useState<RecallItem[]>([]);
    const [weatherAlert, setWeatherAlert] = useState<{ temp: number; message: string } | null>(null);

    const [activeTab, setActiveTab] = useState<"Full Maintenance Info" | "Additional Info.">("Full Maintenance Info");
    const [activeModalVehicle, setActiveModalVehicle] = useState<ApiVehicle | null>(null);
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [isBlurred, setIsBlurred] = useState(false);
    const [savingData, setSavingData] = useState(false);

    const [climate, setClimate] = useState("Moderate");
    const [primaryUsage, setPrimaryUsage] = useState("Daily Commuting");
    const [recentService, setRecentService] = useState("Not Sure");

    useEffect(() => {
        setActiveTab("Full Maintenance Info");
    }, [vehicleId]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setLoading(false);
                setError("Please sign in to view maintenance records.");
                return;
            }

            let currentGarage: ApiVehicle[] = [];
            try {
                const res = await fetch(`${apiUrl}/api/vin/vehicles/${user.uid}`);
                if (res.ok) {
                    const data = await res.json();
                    currentGarage = data.vehicles || [];

                    if (!vehicleId) {
                        const vehiclesWithData = await Promise.all(currentGarage.map(async (car: ApiVehicle) => {
                            const id = car._id || car.id;
                            try {
                                const pRes = await fetch(`${apiUrl}/api/predict/vehicle/${id}?owner_id=${encodeURIComponent(user.uid)}`);
                                if (pRes.ok) {
                                    const pData = await pRes.json();
                                    car.has_in_depth_data = Boolean(pData.model_profile?.climate_condition);
                                }
                            } catch {
                                car.has_in_depth_data = false;
                            }
                            return car;
                        }));
                        setGarageVehicles(vehiclesWithData);
                    }
                }
            } catch (err) {
                console.error("Failed to load garage vehicles:", err);
            }

            if (!vehicleId) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${apiUrl}/api/predict/vehicle/${vehicleId}?owner_id=${encodeURIComponent(user.uid)}`);
                if (!response.ok) throw new Error("Failed to load maintenance data.");

                const data = await response.json();

                const hasFilledForm = Boolean(data.model_profile?.climate_condition);
                setIsBlurred(!hasFilledForm);

                if (autoOpenModal && !hasFilledForm) {
                    setShowQuestionnaire(true);
                } else {
                    setShowQuestionnaire(false);
                }

                const thisCar = currentGarage.find((v) => v._id === vehicleId || v.id === vehicleId);
                const make = data.vehicle?.Make || thisCar?.make || "Unknown";
                const model = data.vehicle?.Model || thisCar?.model || "Vehicle";
                const year = String(data.vehicle?.ModelYear || thisCar?.year || "2020");

                setVehicleDetails({
                    make,
                    model,
                    year,
                    mileage: data.mileage_analyzed || Number(thisCar?.current_mileage || 0),
                    climate: data.model_profile?.climate_condition || "Moderate",
                    usage: data.model_profile?.primary_usage || "Daily Commuting"
                });

                const upcoming: PredictionItem[] = data.prediction?.upcoming_repairs || [];
                setPredictions(upcoming);

                fetch(`https://api.nhtsa.gov/recalls/recallsByVehicle?make=${make}&model=${model}&modelYear=${year}`)
                    .then(res => res.json())
                    .then(recallData => {
                        if (recallData && recallData.results) setRecalls(recallData.results);
                    })
                    .catch(err => console.error("Recall fetch failed:", err));

                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const zipCode = userSnap.data().zipCode;
                    if (zipCode) {
                        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${zipCode}&count=1&language=en&format=json`);
                        const geoData = await geoRes.json();
                        if (geoData.results && geoData.results.length > 0) {
                            const { latitude, longitude } = geoData.results[0];
                            const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=fahrenheit`);
                            const wxData = await wxRes.json();
                            const temp = wxData.current_weather?.temperature;

                            if (temp !== undefined) {
                                if (temp < 40) {
                                    setWeatherAlert({ temp, message: "Freezing temps detected. Cold weather reduces battery cranking power by up to 30% and under-inflates tires." });
                                } else if (temp > 85) {
                                    setWeatherAlert({ temp, message: "Extreme heat detected. This accelerates tire wear, stresses your cooling system, and degrades your battery." });
                                } else {
                                    setWeatherAlert({ temp, message: "Local weather conditions are optimal for vehicle performance." });
                                }
                            }
                        }
                    }
                }

            } catch (err) {
                console.error(err);
                setError("Unable to load maintenance records at this time.");
            } finally {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [vehicleId, autoOpenModal]);

    const handleOpenQuestionnaire = (car: ApiVehicle) => {
        if (car.has_in_depth_data) {
            router.push(`/maintenance?vehicle=${car._id || car.id}`);
        } else {
            setActiveModalVehicle(car);
        }
    };

    const handleSkipQuestionnaire = () => {
        if (activeModalVehicle) {
            const id = activeModalVehicle._id || activeModalVehicle.id;
            setActiveModalVehicle(null);
            router.push(`/maintenance?vehicle=${id}`);
        } else {
            setShowQuestionnaire(false);
            setIsBlurred(false);
            if (vehicleId) router.replace(`/maintenance?vehicle=${vehicleId}`, { scroll: false });
        }
    };

    const handleSubmitQuestionnaire = async () => {
        if (!auth.currentUser) return;
        setSavingData(true);

        const id = activeModalVehicle ? (activeModalVehicle._id || activeModalVehicle.id) : vehicleId;
        if (!id) return;

        try {
            await fetch(`${apiUrl}/api/vin/vehicles/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner_id: auth.currentUser.uid,
                    climate_condition: climate,
                    primary_usage: primaryUsage,
                    recent_major_service: recentService
                }),
            });

            await fetch(`${apiUrl}/api/predict/vehicle/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ owner_id: auth.currentUser.uid })
            });

            if (activeModalVehicle) {
                setActiveModalVehicle(null);
                router.push(`/maintenance?vehicle=${id}`);
            } else {
                const response = await fetch(`${apiUrl}/api/predict/vehicle/${id}?owner_id=${encodeURIComponent(auth.currentUser.uid)}`);
                if (response.ok) {
                    const data = await response.json();
                    setVehicleDetails(prev => ({
                        ...(prev as VehicleDetails),
                        climate: data.model_profile?.climate_condition || climate,
                        usage: data.model_profile?.primary_usage || primaryUsage
                    }));
                    setPredictions(data.prediction?.upcoming_repairs || []);
                }

                setShowQuestionnaire(false);
                setIsBlurred(false);
                router.replace(`/maintenance?vehicle=${id}`, { scroll: false });
            }
        } catch (err) {
            console.error("Failed to save questionnaire:", err);
            if (activeModalVehicle) {
                setActiveModalVehicle(null);
                router.push(`/maintenance?vehicle=${id}`);
            } else {
                setShowQuestionnaire(false);
                setIsBlurred(false);
            }
        } finally {
            setSavingData(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 size={32} className="animate-spin text-[#001F3F]" />
            </div>
        );
    }


    if (!vehicleId) {
        return (
            <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8 sm:py-9">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#001F3F]">Maintenance Hub</h1>
                    <p className="mt-2 text-slate-500">
                        Select a vehicle from your garage to unlock its detailed predictive maintenance report.
                    </p>
                </div>

                {garageVehicles.length === 0 ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-slate-500 mb-4">
                            <Car size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Your garage is empty</h3>
                        <p className="mt-2 max-w-md text-slate-500">
                            Add a vehicle to your garage to start receiving AI-powered predictive maintenance forecasts.
                        </p>
                        <Link href="/garage" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 font-semibold text-white transition hover:bg-[#003366]">
                            <Plus size={18} /> Add a Vehicle
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {garageVehicles.map((car) => {
                            const id = car._id || car.id;
                            const title = `${car.year || ""} ${car.make || ""} ${car.model || ""}`.trim();
                            const mileage = Number(car.current_mileage || 0).toLocaleString();
                            const hasData = Boolean(car.has_in_depth_data);

                            return (
                                <div key={id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                                    {/* Top: Car Info */}
                                    <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/50 p-5">
                                        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-white p-1 border border-slate-100 shadow-sm">
                                            <img
                                                src={createCarImage(String(car.make), String(car.model), String(car.year))}
                                                alt={title}
                                                className="h-full w-full object-contain"
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 line-clamp-1" title={title}>{title}</h3>
                                            <p className="mt-0.5 text-sm text-slate-500">{mileage} miles</p>
                                        </div>
                                    </div>

                                    {/* Bottom: Blurred Maintenance Preview */}
                                    <div className="relative p-6 h-48">
                                        <div className="pointer-events-none select-none space-y-4 opacity-30 grayscale-[0.5] blur-[5px]">
                                            <div className="flex items-center justify-between">
                                                <div className="h-5 w-32 rounded bg-slate-400"></div>
                                                <div className="h-5 w-16 rounded bg-slate-400"></div>
                                            </div>
                                            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                                                <div className="h-full w-3/4 rounded-full bg-red-400"></div>
                                            </div>
                                            <div className="h-4 w-full rounded bg-slate-300 mt-6"></div>
                                            <div className="h-4 w-5/6 rounded bg-slate-300"></div>
                                            <div className="h-4 w-4/6 rounded bg-slate-300"></div>
                                        </div>

                                        {/* Floating White Overlay Box */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                            <div className="w-full rounded-xl border border-slate-100 bg-white/95 p-5 text-center shadow-lg backdrop-blur-md">
                                                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#001F3F]">
                                                    <Wrench size={18} />
                                                </div>
                                                <h4 className="font-bold text-slate-900">Predictive Report</h4>
                                                <p className="mb-4 mt-1 text-xs text-slate-500">
                                                    {hasData ? "Diagnostic forecast is ready to view." : "Provide usage details to unlock accurate forecasts."}
                                                </p>

                                                <button
                                                    onClick={() => handleOpenQuestionnaire(car)}
                                                    className="inline-block w-full rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
                                                >
                                                    {hasData ? "View report" : "Improve accuracy"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* GRID MODAL */}
                {activeModalVehicle && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                        <div className="relative w-full max-w-lg overflow-visible rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
                            <button
                                onClick={() => setActiveModalVehicle(null)}
                                className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 hover:scale-105"
                                aria-label="Close"
                            >
                                <X size={20} strokeWidth={2.5} />
                            </button>

                            <div className="mb-6 text-center">
                                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#001F3F]">
                                    <Car size={24} />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900">Refine Your Forecast</h2>
                                <p className="mt-2 text-sm text-slate-500">
                                    Help our ML model understand the {activeModalVehicle.make} {activeModalVehicle.model}'s environment.
                                </p>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Primary Climate</label>
                                    <select value={climate} onChange={(e) => setClimate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]">
                                        <option value="Moderate">Moderate (Average Seasons)</option>
                                        <option value="Extreme Cold">Extreme Cold / Salted Roads</option>
                                        <option value="Extreme Heat">Extreme Heat / Desert</option>
                                        <option value="Coastal">Coastal / High Humidity</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Primary Usage</label>
                                    <select value={primaryUsage} onChange={(e) => setPrimaryUsage(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]">
                                        <option value="Daily Commuting">Daily Commuting</option>
                                        <option value="Rideshare">Rideshare / Delivery</option>
                                        <option value="Weekend Cruiser">Weekend Cruiser / Occasional Use</option>
                                        <option value="Heavy Towing">Heavy Towing / Work Truck</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Last Major Service</label>
                                    <select value={recentService} onChange={(e) => setRecentService(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]">
                                        <option value="Not Sure">Not Sure / Default</option>
                                        <option value="Last 3 Months">Within the last 3 Months</option>
                                        <option value="Last 12 Months">Within the last 12 Months</option>
                                        <option value="Over 2 Years Ago">Over 2 Years Ago</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
                                <button
                                    onClick={handleSkipQuestionnaire}
                                    disabled={savingData}
                                    className="rounded-xl bg-blue-50 px-6 py-3 font-semibold text-blue-600 transition hover:bg-blue-100 disabled:opacity-50"
                                >
                                    Skip
                                </button>
                                <button
                                    onClick={handleSubmitQuestionnaire}
                                    disabled={savingData}
                                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-50"
                                >
                                    {savingData ? <Loader2 size={18} className="animate-spin" /> : null} Submit
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }


    if (error) {
        return (
            <div className="mx-auto max-w-5xl px-5 py-9">
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
                    <AlertTriangle size={32} className="mx-auto mb-3" />
                    <p className="font-semibold">{error}</p>
                    <Link href="/maintenance" className="mt-4 inline-block text-sm font-medium underline hover:text-red-800">
                        Return to Maintenance Hub
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-9">

            {/* HEADER - margin bumped to mb-10 for extra space */}
            <div className="mb-10 flex items-center justify-between">
                <div>
                    <Link href="/maintenance" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#001F3F]">
                        <ChevronLeft size={16} /> Back to Hub
                    </Link>
                    <h1 className="text-3xl font-bold text-[#001F3F]">Diagnostic Report</h1>
                </div>
            </div>

            {/* VEHICLE OVERVIEW CARD & DRIVING PROFILE */}
            {vehicleDetails && (
                <div className={`mb-8 grid grid-cols-1 gap-5 lg:grid-cols-12 transition-all duration-500 ${isBlurred ? "pointer-events-none select-none blur-[6px] grayscale-[0.5]" : ""}`}>

                    <div className="lg:col-span-12 xl:col-span-6 flex items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-50/80 p-2 mix-blend-multiply border border-slate-200">
                            <img
                                src={createCarImage(vehicleDetails.make, vehicleDetails.model, vehicleDetails.year)}
                                alt="Vehicle"
                                className="h-full w-full object-contain"
                            />
                        </div>
                        {/* min-w-0 forces the text to truncate cleanly rather than pushing the grid out */}
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-bold text-slate-900 truncate" title={`${vehicleDetails.year} ${vehicleDetails.make} ${vehicleDetails.model}`}>
                                {vehicleDetails.year} {vehicleDetails.make} {vehicleDetails.model}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 font-medium">{vehicleDetails.mileage.toLocaleString()} total miles</p>
                        </div>
                    </div>

                    <div className="lg:col-span-6 xl:col-span-3 rounded-2xl border border-[#001F3F]/10 bg-linear-to-br from-blue-50 to-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 border-b border-[#001F3F]/10 pb-2">
                            <Activity size={16} className="text-[#001F3F]" />
                            <h3 className="text-sm font-semibold text-slate-900">Driving Profile</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <MapPin size={14} className="text-slate-400 shrink-0" />
                                <span className="truncate"><span className="font-medium text-slate-800">{vehicleDetails.usage}</span> wear</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                <ThermometerSnowflake size={14} className="text-slate-400 shrink-0" />
                                <span className="truncate"><span className="font-medium text-slate-800">{vehicleDetails.climate}</span> climate</span>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-6 xl:col-span-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-3 border-b border-emerald-200 pb-2">
                            <CloudRain size={16} className="text-emerald-700" />
                            <h3 className="text-sm font-semibold text-emerald-900">Local Environment</h3>
                        </div>
                        {weatherAlert ? (
                            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                                {weatherAlert.message}
                            </p>
                        ) : (
                            <div className="flex items-center gap-2 text-xs text-emerald-600">
                                <Loader2 size={12} className="animate-spin" /> Fetching area data...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TABS */}
            <div className={`mb-6 flex gap-2 overflow-x-auto border-b border-slate-200 transition-all duration-500 ${isBlurred ? "pointer-events-none select-none blur-[6px] grayscale-[0.5]" : ""}`}>
                {(["Full Maintenance Info", "Additional Info."] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium transition ${
                            activeTab === tab
                                ? "border-[#001F3F] text-[#001F3F]"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* CONTENT AREA */}
            {activeTab === "Additional Info." ? (
                <div className={`transition-all duration-500 ${isBlurred ? "pointer-events-none select-none blur-[6px] grayscale-[0.5]" : ""}`}>

                    <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-900">Active Safety Recalls</h3>
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              {recalls.length} records found
            </span>
                    </div>

                    {recalls.length === 0 ? (
                        <div className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                            <ShieldAlert size={32} className="text-emerald-500 mb-3" />
                            <h3 className="text-lg font-semibold text-emerald-800">No active recalls</h3>
                            <p className="mt-2 max-w-md text-sm text-slate-500">
                                The NHTSA database shows no active safety recalls for this specific Make, Model, and Year combination.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {recalls.map((recall, index) => (
                                <div key={index} className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                        <h4 className="font-bold text-red-700">{recall.Component}</h4>
                                        <span className="text-xs font-semibold text-slate-400">Reported: {recall.ReportReceivedDate}</span>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        <div>
                                            <p className="font-semibold text-slate-800">Issue Summary:</p>
                                            <p className="text-slate-600 leading-relaxed">{recall.Summary}</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">Consequence:</p>
                                            <p className="text-slate-600 leading-relaxed">{recall.Consequence}</p>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 p-3">
                                            <p className="font-semibold text-[#001F3F]">Recommended Remedy:</p>
                                            <p className="text-slate-600">{recall.Remedy}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <p className="mt-6 text-center text-xs text-slate-400">Data provided by the official NHTSA Federal Database.</p>
                        </div>
                    )}

                    {/* SIMULATED FACTORY SCHEDULE */}
                    <div className="mt-12">
                        <h3 className="mb-5 text-lg font-bold text-slate-900">Factory Maintenance Schedule</h3>
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

                            <div className="flex gap-5">
                                <div className="flex flex-col items-center">
                                    <div className="h-4 w-4 shrink-0 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                                    <div className="my-1 w-0.5 flex-1 bg-slate-100"></div>
                                </div>
                                <div className="pb-8">
                                    <h4 className="font-bold leading-tight text-slate-900">Every 5,000 Miles</h4>
                                    <p className="mt-1 text-sm text-slate-500">Synthetic oil and filter change. Rotate tires and inspect brake pads.</p>
                                </div>
                            </div>

                            <div className="flex gap-5">
                                <div className="flex flex-col items-center">
                                    <div className="h-4 w-4 shrink-0 rounded-full bg-amber-500 ring-4 ring-white"></div>
                                    <div className="my-1 w-0.5 flex-1 bg-slate-100"></div>
                                </div>
                                <div className="pb-8">
                                    <h4 className="font-bold leading-tight text-slate-900">Every 30,000 Miles</h4>
                                    <p className="mt-1 text-sm text-slate-500">Replace engine air filter, cabin air filter, and inspect suspension components.</p>
                                </div>
                            </div>

                            <div className="flex gap-5">
                                <div className="flex flex-col items-center">
                                    <div className="h-4 w-4 shrink-0 rounded-full bg-red-500 ring-4 ring-white"></div>
                                    <div className="my-1 w-0.5 flex-1 bg-transparent"></div>
                                </div>
                                <div>
                                    <h4 className="font-bold leading-tight text-slate-900">Every 60,000 Miles</h4>
                                    <p className="mt-1 text-sm text-slate-500">Transmission fluid flush, spark plug replacement, and drive belt inspection.</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative">

                    {isBlurred && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-3xl bg-white/30 backdrop-blur-md">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl max-w-sm">
                                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#001F3F]">
                                    <Wrench size={18} />
                                </div>
                                <h4 className="font-bold text-slate-900">Unlock Full Report</h4>
                                <p className="mb-4 mt-1 text-xs text-slate-500">Provide usage details to unlock accurate forecasts.</p>

                                <button
                                    onClick={() => setShowQuestionnaire(true)}
                                    className="inline-block w-full rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
                                >
                                    Improve accuracy
                                </button>
                            </div>
                        </div>
                    )}

                    <div className={`space-y-5 transition-all duration-500 ${isBlurred ? "pointer-events-none select-none blur-[6px] grayscale-[0.5]" : ""}`}>
                        {predictions.length === 0 || predictions[0]?.part === "None expected soon" ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-12 text-center shadow-sm">
                                <CheckCircle size={48} className="text-emerald-500 mb-4" />
                                <h2 className="text-2xl font-bold text-emerald-900">Optimal Condition</h2>
                                <p className="mt-2 text-emerald-700 max-w-lg">
                                    Based on our predictive model and your driving profile, your vehicle currently has no immediate maintenance needs.
                                </p>
                            </div>
                        ) : (
                            <>
                                {predictions.map((pred, idx) => {
                                    const prob = Math.round(pred.probability * 100);
                                    const isHighRisk = prob >= 75;
                                    const isMedRisk = prob >= 60 && prob < 75;

                                    return (
                                        <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                                            <div className="border-b border-slate-100 p-6">
                                                <div className="flex flex-col sm:flex-row sm:items-start gap-8">

                                                    {/* Left Column: Part Name & Cost */}
                                                    <div className="sm:w-[280px] shrink-0">
                                                        <div className="flex items-start gap-3">
                                                            <h2 className="text-2xl font-bold text-slate-900">{pred.part}</h2>
                                                            <span className={`inline-block rounded-full px-3 py-1.5 text-center text-[11px] font-bold leading-tight ${
                                                                isHighRisk ? "bg-red-50 text-red-700" : isMedRisk ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                                                            }`}>
                                {isHighRisk ? <>Immediate<br/>Attention</> : isMedRisk ? <>Monitor<br/>Closely</> : <>Upcoming<br/>Maintenance</>}
                              </span>
                                                        </div>
                                                        <p className="mt-4 text-sm text-slate-500">
                                                            Estimated standard<br/>replacement cost: <span className="font-bold text-slate-900">${pred.estimated_cost}</span>
                                                        </p>
                                                    </div>

                                                    {/* Right Column: Wide Risk Bar */}
                                                    <div className="flex-1 w-full pt-1">
                                                        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Risk Assessment</p>
                                                        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${isHighRisk ? "bg-red-500" : isMedRisk ? "bg-amber-500" : "bg-emerald-500"}`}
                                                                style={{ width: `${prob}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>

                                            <div className="bg-slate-50 p-5 sm:p-6">
                                                <div className="flex gap-3">
                                                    <Info className="shrink-0 text-[#001F3F] mt-0.5" size={18} />
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">Pro Tip</p>
                                                        <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                                                            {getProTip(pred.part)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* NEXT STEPS MECHANIC CTA TO FILL WHITESPACE */}
                                {predictions.length > 0 && (
                                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl bg-[#001F3F] p-8 text-white shadow-lg">
                                        <div>
                                            <h3 className="text-xl font-bold">Ready to take care of this?</h3>
                                            <p className="mt-2 text-sm text-blue-100/80 max-w-md leading-relaxed">
                                                Don't let these issues turn into costly repairs. Find a trusted local mechanic to inspect your {vehicleDetails?.make} {vehicleDetails?.model}.
                                            </p>
                                        </div>
                                        <Link
                                            href="/mechanics"
                                            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-[#001F3F] shadow-sm transition hover:bg-blue-50"
                                        >
                                            Find Mechanics <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* SINGLE PAGE QUESTIONNAIRE MODAL */}
            {showQuestionnaire && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-lg overflow-visible rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
                        <button
                            onClick={() => {
                                setShowQuestionnaire(false);
                                if (vehicleId) router.replace(`/maintenance?vehicle=${vehicleId}`, { scroll: false });
                            }}
                            className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600 hover:scale-105"
                            aria-label="Close"
                        >
                            <X size={20} strokeWidth={2.5} />
                        </button>

                        <div className="mb-6 text-center">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#001F3F]">
                                <Car size={24} />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900">Refine Your Forecast</h2>
                            <p className="mt-2 text-sm text-slate-500">
                                Help our ML model understand your vehicle's environment to generate highly accurate predictions.
                            </p>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Primary Climate</label>
                                <select value={climate} onChange={(e) => setClimate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]">
                                    <option value="Moderate">Moderate (Average Seasons)</option>
                                    <option value="Extreme Cold">Extreme Cold</option>
                                    <option value="Extreme Heat">Extreme Heat</option>
                                    <option value="Coastal">Coastal / High Humidity</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Primary Usage</label>
                                <select value={primaryUsage} onChange={(e) => setPrimaryUsage(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]">
                                    <option value="Daily Commuting">Daily Commuting</option>
                                    <option value="Rideshare">Rideshare / Delivery</option>
                                    <option value="Weekend Cruiser">Occasional Use</option>
                                    <option value="Heavy Towing">Work Truck</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Last Major Service</label>
                                <select value={recentService} onChange={(e) => setRecentService(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]">
                                    <option value="Not Sure">Default</option>
                                    <option value="Last 3 Months">Within the last 3 Months</option>
                                    <option value="Last 12 Months">Within the last 12 Months</option>
                                    <option value="Over 2 Years Ago">Over 2 Years Ago</option>
                                </select>
                            </div>
                        </div>

                        <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
                            <button
                                onClick={handleSkipQuestionnaire}
                                disabled={savingData}
                                className="rounded-xl bg-blue-50 px-6 py-3 font-semibold text-blue-600 transition hover:bg-blue-100 disabled:opacity-50"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handleSubmitQuestionnaire}
                                disabled={savingData}
                                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-3 font-semibold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-50"
                            >
                                {savingData ? <Loader2 size={18} className="animate-spin" /> : null} Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MaintenancePage() {
    return (
        <Suspense fallback={
                      <div className="flex min-h-[60vh] items-center justify-center">
                          <Loader2 size={32} className="animate-spin text-[#001F3F]" />
                      </div>
                  }>
            <MaintenanceHubContent />
        </Suspense>
    );
}
