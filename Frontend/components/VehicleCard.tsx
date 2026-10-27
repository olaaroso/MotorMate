"use client";

import {
    useEffect,
    useState,
    type ChangeEvent,
    type ElementType,
    type FormEvent,
    type ReactNode,
} from "react";
import {
    CalendarDays,
    Car,
    Edit3,
    FileText,
    Loader2,
    MoreHorizontal,
    Tag,
    Trash2,
    Wrench,
    X,
    Sparkles,
    Activity
} from "lucide-react";

import Link from "next/link";
import { auth } from "@/lib/firebase";
import { createCarImage } from "@/lib/carImage";
import ServiceHistory, {
    type ServiceHistorySummary,
} from "@/components/ServiceHistory";

export interface Vehicle {
    _id?: string;
    id?: string;
    owner_id?: string;
    vin?: string | null;
    make: string;
    model: string;
    year: number;
    current_mileage?: number;
    driving_habits?: string;
    created_at?: string;
}

export interface PredictionItem {
    part: string;
    probability: number;
    estimated_cost: number;
}

type VehicleTab = "Overview" | "Maintenance" | "Service History" | "Documents";

interface VehicleCardProps {
    vehicle: Vehicle;
    onVehicleUpdated?: (updatedVehicle: Vehicle) => void;
    onVehicleRemoved?: (vehicleId: string) => void;
    onPredictionUpdated?: (
        vehicleId: string,
        prediction: PredictionItem | null
    ) => void;
}

const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const DRIVING_HABITS = [
    { value: "City Commute", label: "City / Stop-and-Go Commute" },
    { value: "Highway", label: "Highway / Long Distance" },
    { value: "Mixed", label: "Mixed Commute (50/50)" },
    {
        value: "Severe / Towing",
        label: "Severe (Frequent Towing, Mountain Driving)",
    },
] as const;

function getVehicleId(vehicle: Vehicle) {
    return vehicle._id || vehicle.id || "";
}

function normalizeVehicle(vehicle: Vehicle): Vehicle {
    return {
        ...vehicle,
        _id: vehicle._id || vehicle.id,
        id: vehicle.id || vehicle._id,
        make: String(vehicle.make || "").trim(),
        model: String(vehicle.model || "").trim(),
        year: Number(vehicle.year) || new Date().getFullYear(),
        current_mileage: Number(vehicle.current_mileage) || 0,
        driving_habits: vehicle.driving_habits || "City Commute",
    };
}

export default function VehicleCard({
                                        vehicle,
                                        onVehicleUpdated,
                                        onVehicleRemoved,
                                        onPredictionUpdated,
                                    }: VehicleCardProps) {
    const vehicleId = getVehicleId(vehicle);
    const isVinVehicle = Boolean(vehicle.vin);

    const [activeTab, setActiveTab] = useState<VehicleTab>("Overview");
    const [menuOpen, setMenuOpen] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [mileage, setMileage] = useState(vehicle.current_mileage || 0);
    const [displayMileage, setDisplayMileage] = useState(
        vehicle.current_mileage || 0
    );
    const [drivingHabits, setDrivingHabits] = useState(
        vehicle.driving_habits || "City Commute"
    );
    const [make, setMake] = useState(vehicle.make || "");
    const [model, setModel] = useState(vehicle.model || "");
    const [year, setYear] = useState(
        Number(vehicle.year) || new Date().getFullYear()
    );
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState("");

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const [predictions, setPredictions] = useState<PredictionItem[]>([]);
    const [predictionLoading, setPredictionLoading] = useState(false);
    const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
    const [diagnosticsError, setDiagnosticsError] = useState("");

    const [imageFailed, setImageFailed] = useState(false);

    const [serviceSummary, setServiceSummary] =
        useState<ServiceHistorySummary>({
            total: 0,
            lastServiceTitle: null,
            lastServiceDate: null,
        });

    const handleOpenEdit = () => {
        setMileage(Number(vehicle.current_mileage) || 0);
        setDrivingHabits(vehicle.driving_habits || "City Commute");
        setMake(vehicle.make || "");
        setModel(vehicle.model || "");
        setYear(Number(vehicle.year) || new Date().getFullYear());
        setEditError("");
        setMenuOpen(false);
        setIsEditing(true);
    };

    useEffect(() => {
        let cancelled = false;

        async function loadSavedPrediction() {
            const currentUserId = vehicle.owner_id || auth.currentUser?.uid;
            if (!vehicleId || !currentUserId) return;

            setPredictionLoading(true);

            try {
                const response = await fetch(`${apiUrl}/api/predict/vehicle/${vehicleId}?owner_id=${encodeURIComponent(currentUserId)}`, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) {
                    if (!cancelled) {
                        setPredictions([]);
                        onPredictionUpdated?.(vehicleId, null);
                    }
                    return;
                }

                const data = await response.json();
                const upcoming: PredictionItem[] = data.prediction?.upcoming_repairs || [];

                if (!cancelled) {
                    setPredictions(upcoming);
                    onPredictionUpdated?.(vehicleId, upcoming[0] || null);
                }
            } catch (error) {
                console.warn("Saved prediction fetch error:", error);
                if (!cancelled) {
                    setPredictions([]);
                    onPredictionUpdated?.(vehicleId, null);
                }
            } finally {
                if (!cancelled) {
                    setPredictionLoading(false);
                }
            }
        }

        loadSavedPrediction();

        return () => {
            cancelled = true;
        };
    }, [vehicleId, vehicle.owner_id, onPredictionUpdated]);

    const handleRunDiagnostics = async () => {
        const currentUserId = vehicle.owner_id || auth.currentUser?.uid;
        if (!vehicleId || !currentUserId) return;

        setActiveTab("Maintenance");
        setDiagnosticsLoading(true);
        setDiagnosticsError("");

        try {
            const response = await fetch(`${apiUrl}/api/predict/vehicle/${vehicleId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    owner_id: currentUserId,
                    mileage: Number(displayMileage) || 0
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.detail || `Backend returned status ${response.status}`);
            }

            const data = await response.json();
            const upcoming: PredictionItem[] = data.upcoming_repairs || [];

            setPredictions(upcoming);
            onPredictionUpdated?.(vehicleId, upcoming[0] || null);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to run ML diagnostics";
            setDiagnosticsError(errorMessage);
        } finally {
            setDiagnosticsLoading(false);
        }
    };

    const handleUpdate = async (event: FormEvent) => {
        event.preventDefault();

        if (!vehicleId) {
            setEditError("This vehicle is missing its database ID.");
            return;
        }

        const currentUserId = vehicle.owner_id || auth.currentUser?.uid;

        if (!currentUserId) {
            setEditError("You must be signed in to update this vehicle.");
            return;
        }

        if (mileage < 0) {
            setEditError("Mileage cannot be negative.");
            return;
        }

        if (!isVinVehicle) {
            if (!make.trim() || !model.trim()) {
                setEditError("Make and model are required.");
                return;
            }

            if (year < 1900 || year > 2100) {
                setEditError("Please enter a valid model year.");
                return;
            }
        }

        setEditLoading(true);
        setEditError("");

        const payload: Record<string, string | number> = {
            owner_id: currentUserId,
            current_mileage: Number(mileage),
            driving_habits: drivingHabits,
        };

        if (!isVinVehicle) {
            payload.make = make.trim();
            payload.model = model.trim();
            payload.year = Number(year);
        }

        try {
            const response = await fetch(
                `${apiUrl}/api/vin/vehicles/${vehicleId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Failed to update vehicle.");
            }

            const data = await response.json();
            const updatedVehicle = normalizeVehicle(
                data.vehicle_details || {
                    ...vehicle,
                    current_mileage: Number(mileage),
                    driving_habits: drivingHabits,
                    ...(!isVinVehicle
                        ? {
                            make: make.trim(),
                            model: model.trim(),
                            year: Number(year),
                        }
                        : {}),
                }
            );

            onVehicleUpdated?.(updatedVehicle);
            setDisplayMileage(updatedVehicle.current_mileage || 0);
            setIsEditing(false);
        } catch (error) {
            setEditError(
                error instanceof Error ? error.message : "Failed to update vehicle."
            );
        } finally {
            setEditLoading(false);
        }
    };

    const handleRemove = async () => {
        if (!vehicleId) {
            setDeleteError("This vehicle is missing its database ID.");
            return;
        }

        const currentUserId = vehicle.owner_id || auth.currentUser?.uid;

        if (!currentUserId) {
            setDeleteError("You must be signed in to remove this vehicle.");
            return;
        }

        setDeleteLoading(true);
        setDeleteError("");

        try {
            const response = await fetch(
                `${apiUrl}/api/vin/vehicles/${vehicleId}?owner_id=${encodeURIComponent(
                    currentUserId
                )}`,
                { method: "DELETE" }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "Failed to remove vehicle.");
            }

            onVehicleRemoved?.(vehicleId);
            setDeleteOpen(false);
        } catch (error) {
            setDeleteError(
                error instanceof Error ? error.message : "Failed to remove vehicle."
            );
        } finally {
            setDeleteLoading(false);
        }
    };

    const topPrediction = predictions.length > 0 ? predictions[0] : null;
    const isNoneExpected = topPrediction?.part === "None expected soon";
    const likelihood = topPrediction ? Math.round(topPrediction.probability * 100) : null;

    const predictionColor =
        likelihood === null
            ? "bg-slate-300"
            : likelihood >= 75
                ? "bg-red-500"
                : likelihood >= 60
                    ? "bg-amber-500"
                    : "bg-emerald-500";

    const predictionTextColor =
        likelihood === null
            ? "text-slate-500"
            : likelihood >= 75
                ? "text-red-600"
                : likelihood >= 60
                    ? "text-amber-600"
                    : "text-emerald-600";

    const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

    return (
        <section className="group overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-shadow duration-300 hover:shadow-lg">
            <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="flex h-44 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-slate-100 lg:w-64">
                        {!imageFailed ? (
                            <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={createCarImage(
                                        vehicle.make,
                                        vehicle.model,
                                        String(vehicle.year)
                                    )}
                                    alt={vehicleName}
                                    onError={() => setImageFailed(true)}
                                    className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                            </>
                        ) : (
                            <div className="text-center text-slate-400">
                                <Car size={42} className="mx-auto text-slate-300" />
                                <p className="mt-2 text-sm font-medium">
                                    {vehicle.make} {vehicle.model}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                        {vehicleName}
                                    </h2>

                                    {vehicle.vin && (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      VIN verified
                    </span>
                                    )}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                    {displayMileage.toLocaleString()} miles
                  </span>

                                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-[#001F3F]">
                    {vehicle.driving_habits || "City Commute"}
                  </span>
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">

                                {/* DIAGNOSTICS BUTTON */}
                                <button
                                    type="button"
                                    onClick={handleRunDiagnostics}
                                    disabled={diagnosticsLoading}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-[#001F3F] transition hover:bg-blue-100 disabled:opacity-50"
                                >
                                    {diagnosticsLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                                    <span className="hidden sm:inline">Predict Repairs</span>
                                    <span className="sm:hidden">Predict</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleOpenEdit}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                    <Edit3 size={15} />
                                    <span className="hidden sm:inline">Edit</span>
                                </button>

                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setMenuOpen((previous) => !previous)}
                                        aria-label="More vehicle options"
                                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                                    >
                                        <MoreHorizontal size={18} />
                                    </button>

                                    {menuOpen && (
                                        <div className="absolute right-0 top-11 z-30 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setMenuOpen(false);
                                                    setDeleteError("");
                                                    setDeleteOpen(true);
                                                }}
                                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                                            >
                                                <Trash2 size={15} />
                                                Remove Vehicle
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-2">
                            <VehicleDetailBadge label="Make" value={vehicle.make} />
                            <VehicleDetailBadge label="Model" value={vehicle.model} />
                            <VehicleDetailBadge label="Year" value={String(vehicle.year)} />
                            <VehicleDetailBadge
                                label="Source"
                                value={vehicle.vin ? "VIN / NHTSA" : "Manual"}
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-7 flex gap-1 overflow-x-auto border-b border-slate-200">
                    {(
                        ["Overview", "Maintenance", "Service History", "Documents"] as const
                    ).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`whitespace-nowrap px-4 py-3 text-sm transition ${
                                activeTab === tab
                                    ? "border-b-2 border-[#001F3F] font-semibold text-[#001F3F]"
                                    : "font-medium text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="mt-5">
                    {activeTab === "Overview" && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <GarageInfoCard title="Predicted Maintenance" icon={Wrench}>
                                <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">
                                        {predictionLoading || diagnosticsLoading
                                            ? "Loading..."
                                            : isNoneExpected
                                                ? "None required"
                                                : topPrediction?.part || "N/A"}
                                    </p>

                                    {predictionLoading || diagnosticsLoading ? (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                                            <Loader2 size={13} className="animate-spin" />
                                            {diagnosticsLoading ? "Analyzing..." : "Loading forecast"}
                                        </div>
                                    ) : isNoneExpected ? (
                                        <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-emerald-600">
                        Optimal condition
                      </span>
                                            <span className="text-xs text-slate-400">
                        ML prediction
                      </span>
                                        </div>
                                    ) : topPrediction && likelihood !== null ? (
                                        <>
                                            <div className="mt-2 flex items-center justify-between gap-3">
                        <span
                            className={`text-xs font-semibold ${predictionTextColor}`}
                        >
                          {likelihood}% likelihood
                        </span>
                                                <span className="text-xs text-slate-400">
                          ML prediction
                        </span>
                                            </div>

                                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${predictionColor}`}
                                                    style={{ width: `${likelihood}%` }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <p className="mt-1 text-sm text-amber-600">
                                            Prediction unavailable
                                        </p>
                                    )}
                                </div>
                            </GarageInfoCard>

                            <GarageInfoCard
                                title="Last Service"
                                icon={CalendarDays}
                            >
                                <p className="font-semibold text-slate-900">
                                    {serviceSummary.lastServiceTitle ||
                                        "No service recorded"}
                                </p>

                                <p className="mt-1 text-sm text-slate-500">
                                    {formatServiceDate(
                                        serviceSummary.lastServiceDate
                                    )}
                                </p>
                            </GarageInfoCard>

                            <GarageInfoCard
                                title="Service Records"
                                icon={FileText}
                            >
                                <div className="flex items-end gap-2">
                                    <p className="text-3xl font-bold text-slate-900">
                                        {serviceSummary.total}
                                    </p>

                                    <span className="mb-1 text-xs text-slate-400">
                    total
                  </span>
                                </div>
                            </GarageInfoCard>

                            <GarageInfoCard title="Estimated Repair Cost" icon={Tag}>
                                <p className="text-2xl font-bold text-slate-900">
                                    {predictionLoading || diagnosticsLoading
                                        ? "..."
                                        : isNoneExpected
                                            ? "$0"
                                            : topPrediction
                                                ? `$${topPrediction.estimated_cost}`
                                                : "N/A"}
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                    {isNoneExpected ? "No immediate costs" : "Based on predicted repair"}
                                </p>
                            </GarageInfoCard>
                        </div>
                    )}

                    {activeTab === "Maintenance" && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                            {predictionLoading || diagnosticsLoading ? (
                                <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                                    <Loader2 size={18} className="animate-spin text-[#001F3F]" />
                                    {diagnosticsLoading ? "Running predictive analysis..." : "Loading saved forecast..."}
                                </div>
                            ) : predictions.length > 0 ? (
                                <div>
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            Upcoming Maintenance Preview
                                        </p>
                                        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-[#001F3F]">
                      {isNoneExpected ? "0" : predictions.length} alerts
                    </span>
                                    </div>

                                    {isNoneExpected ? (
                                        <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-center shadow-sm">
                                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
                                                <Sparkles size={24} />
                                            </div>
                                            <p className="font-semibold text-emerald-800">Your vehicle is looking great!</p>
                                            <p className="mt-1 text-sm text-emerald-600">Our ML model doesn't predict any immediate maintenance needs based on your current mileage and driving habits.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {predictions.slice(0, 3).map((pred, index) => {
                                                const prob = Math.round(pred.probability * 100);
                                                return (
                                                    <div key={index} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                                        <div>
                                                            <p className="font-semibold text-slate-900">{pred.part}</p>
                                                            <p className="text-xs text-slate-500">Est. ${pred.estimated_cost}</p>
                                                        </div>
                                                        <span className={`text-sm font-bold ${prob >= 75 ? "text-red-600" : prob >= 60 ? "text-amber-600" : "text-emerald-600"}`}>
                              {prob}% risk
                            </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {predictions.length > 3 && !isNoneExpected && (
                                        <p className="mt-3 text-center text-xs font-medium text-slate-400">
                                            +{predictions.length - 3} more items detected
                                        </p>
                                    )}

                                    <Link
                                        href={`/maintenance?vehicle=${vehicleId}`}
                                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
                                    >
                                        See Full Diagnostic Report
                                    </Link>
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[#001F3F] shadow-sm ring-1 ring-blue-100">
                                        <Activity size={28} />
                                    </div>
                                    <h3 className="mt-4 text-lg font-semibold text-slate-900">
                                        No maintenance forecast yet
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                                        Run our predictive ML model to forecast upcoming repairs and estimated costs based on your vehicle's make, model, and mileage history.
                                    </p>

                                    {diagnosticsError && (
                                        <div className="mx-auto mt-5 max-w-sm rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600 shadow-sm">
                                            Error: {diagnosticsError}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleRunDiagnostics}
                                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366]"
                                    >
                                        <Sparkles size={16} />
                                        Run Diagnostics Now
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <ServiceHistory
                        isActive={
                            activeTab === "Service History"
                        }
                        vehicleId={vehicleId}
                        ownerId={
                            vehicle.owner_id ||
                            auth.currentUser?.uid
                        }
                        vehicleName={vehicleName}
                        currentMileage={
                            displayMileage
                        }
                        onSummaryChange={
                            setServiceSummary
                        }
                        onMileageUpdated={(newMileage) => {
                            setDisplayMileage(newMileage);
                            onVehicleUpdated?.({
                                ...vehicle,
                                current_mileage: newMileage,
                            });
                        }}
                    />

                    {activeTab === "Documents" && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-center">
                            <FileText size={24} className="mx-auto text-slate-300" />
                            <p className="mt-3 font-medium text-slate-800">
                                No vehicle documents uploaded
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                Registration, insurance, receipts, and other records can live here later.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">
                                    Update vehicle
                                </h3>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Update mileage and driving habits to keep this vehicle profile current.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                aria-label="Close edit vehicle"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="mt-5 space-y-4">
                            {isVinVehicle ? (
                                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                        VIN-decoded identity
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-900">
                                        {vehicle.year} {vehicle.make} {vehicle.model}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">
                                        Make, model, and year stay tied to the decoded VIN. Mileage and driving habits can still be updated.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Make
                                            </label>
                                            <input
                                                type="text"
                                                value={make}
                                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                    setMake(event.target.value)
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Model
                                            </label>
                                            <input
                                                type="text"
                                                value={model}
                                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                    setModel(event.target.value)
                                                }
                                                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            Model Year
                                        </label>
                                        <input
                                            type="number"
                                            min={1900}
                                            max={2100}
                                            value={year}
                                            onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                setYear(Number(event.target.value))
                                            }
                                            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                                            required
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Current Mileage (Miles)
                                </label>
                                <input
                                    type="number"
                                    min={0}
                                    value={mileage}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                        setMileage(Number(event.target.value))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Driving Habits
                                </label>
                                <select
                                    value={drivingHabits}
                                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                                        setDrivingHabits(event.target.value)
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                                >
                                    {DRIVING_HABITS.map((habit) => (
                                        <option key={habit.value} value={habit.value}>
                                            {habit.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {editError && (
                                <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
                                    {editError}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    disabled={editLoading}
                                    onClick={() => setIsEditing(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={editLoading}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:opacity-50"
                                >
                                    {editLoading && <Loader2 size={15} className="animate-spin" />}
                                    {editLoading ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                            <Trash2 size={21} />
                        </div>

                        <h3 className="mt-5 text-xl font-bold text-slate-900">
                            Remove vehicle?
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Remove <span className="font-semibold text-slate-800">{vehicleName}</span> from your garage? This action cannot be undone.
                        </p>

                        {deleteError && (
                            <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
                                {deleteError}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={deleteLoading}
                                onClick={() => setDeleteOpen(false)}
                                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={deleteLoading}
                                onClick={handleRemove}
                                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleteLoading && <Loader2 size={15} className="animate-spin" />}
                                {deleteLoading ? "Removing..." : "Remove Vehicle"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function VehicleDetailBadge({
                                label,
                                value,
                            }: {
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-700">{value}</p>
        </div>
    );
}

function GarageInfoCard({
                            title,
                            icon: Icon,
                            children,
                        }: {
    title: string;
    icon: ElementType;
    children: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all duration-200 hover:border-slate-300 hover:bg-white hover:shadow-sm">
            <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#001F3F] shadow-sm ring-1 ring-slate-200">
                    <Icon size={17} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {title}
                </p>
            </div>
            <div className="mt-4">{children}</div>
        </div>
    );
}

function formatServiceDate(
    value: string | null
) {
    if (!value) return "N/A";

    return new Date(
        `${value}T00:00:00`
    ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}