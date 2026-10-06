"use client";

import React, { useState, useEffect } from "react";
import {
    Wrench,
    Calendar,
    FileText,
    Tag,
    Trash2,
    Edit3,
    X,
    Loader2,
} from "lucide-react";
import { auth } from "@/lib/firebase";

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

interface PredictionItem {
    part: string;
    probability: number;
    estimated_cost: number;
}

interface VehicleCardProps {
    vehicle: Vehicle;
    onVehicleUpdated?: (updatedVehicle: Vehicle) => void;
    onVehicleRemoved?: (vehicleId: string) => void;
}

export default function VehicleCard({
                                        vehicle,
                                        onVehicleUpdated,
                                        onVehicleRemoved,
                                    }: VehicleCardProps) {
    const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

    const [activeTab, setActiveTab] = useState<
        "Overview" | "Maintenance" | "Service History" | "Documents"
    >("Overview");

    // Edit Modal State
    const [isEditing, setIsEditing] = useState(false);
    const [mileage, setMileage] = useState(vehicle.current_mileage || 0);
    const [drivingHabits, setDrivingHabits] = useState(
        vehicle.driving_habits || "City Commute"
    );
    const [make, setMake] = useState(vehicle.make || "");
    const [model, setModel] = useState(vehicle.model || "");
    const [year, setYear] = useState(vehicle.year || new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Dynamic Prediction State
    const [prediction, setPrediction] = useState<PredictionItem | null>(null);
    const [predLoading, setPredLoading] = useState(false);

    // Open modal and initialize form state (eliminates cascading render effect)
    const handleOpenEdit = () => {
        setMileage(vehicle.current_mileage || 0);
        setDrivingHabits(vehicle.driving_habits || "City Commute");
        setMake(vehicle.make || "");
        setModel(vehicle.model || "");
        setYear(vehicle.year || new Date().getFullYear());
        setIsEditing(true);
    };

    // Fetch ML predictions when vehicle properties mutate
    useEffect(() => {
        async function loadPrediction() {
            if (!vehicle.vin && !vehicle.make) return;

            setPredLoading(true);
            try {
                const res = await fetch(`${apiUrl}/api/predict/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        vin: vehicle.vin || undefined,
                        mileage: Number(vehicle.current_mileage) || 0,
                        driving_habits: vehicle.driving_habits || "City Commute",
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const top = data.upcoming_repairs?.[0];
                    if (top) setPrediction(top);
                }
            } catch (err) {
                console.warn("Prediction fetch error in VehicleCard:", err);
            } finally {
                setPredLoading(false);
            }
        }

        loadPrediction();
    }, [
        vehicle.vin,
        vehicle.make,
        vehicle.current_mileage,
        vehicle.driving_habits,
        apiUrl,
    ]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const vehicleId = vehicle._id || vehicle.id;
        const currentUserId = vehicle.owner_id || auth.currentUser?.uid;

        try {
            const res = await fetch(`${apiUrl}/api/vin/vehicles/${vehicleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    current_mileage: Number(mileage),
                    driving_habits: drivingHabits,
                    make: make.trim(),
                    model: model.trim(),
                    year: Number(year),
                    owner_id: currentUserId,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.detail || "Failed to update vehicle");
            }

            const data = await res.json();

            onVehicleUpdated?.(
                data.vehicle_details || {
                    ...vehicle,
                    current_mileage: Number(mileage),
                    driving_habits: drivingHabits,
                    make,
                    model,
                    year: Number(year),
                }
            );

            setIsEditing(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error updating vehicle.";
            console.error(err);
            alert(message);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async () => {
        const vehicleId = vehicle._id || vehicle.id;
        if (!vehicleId) return;

        const currentUserId = vehicle.owner_id || auth.currentUser?.uid || "";

        const confirmed = window.confirm(
            `Are you sure you want to remove the ${vehicle.year} ${vehicle.make} ${vehicle.model}?`
        );
        if (!confirmed) return;

        setDeleting(true);
        try {
            const res = await fetch(
                `${apiUrl}/api/vin/vehicles/${vehicleId}?owner_id=${currentUserId}`,
                {
                    method: "DELETE",
                }
            );

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.detail || "Failed to delete vehicle");
            }

            onVehicleRemoved?.(vehicleId);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Error removing vehicle.";
            console.error(err);
            alert(message);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="w-full rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            {/* Top Section */}
            <div className="flex flex-col gap-6 md:flex-row">
                <div className="flex h-44 w-full shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-sm font-medium text-neutral-400 md:w-56">
                    Vehicle Image
                </div>

                <div className="flex flex-1 flex-col justify-between">
                    <div>
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                                    {vehicle.year} {vehicle.make} {vehicle.model}
                                </h2>
                                <div className="mt-1 flex items-center gap-2.5">
                  <span className="text-sm font-medium text-neutral-500">
                    {(vehicle.current_mileage ?? 0).toLocaleString()} miles
                  </span>
                                    <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#001F3F]">
                    {vehicle.driving_habits || "City Commute"}
                  </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleOpenEdit}
                                    className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3.5 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900"
                                >
                                    <Edit3 className="h-3.5 w-3.5" />
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    disabled={deleting}
                                    className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/50 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-100 hover:text-red-700 disabled:opacity-50"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {deleting ? "Removing..." : "Remove"}
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-3 gap-6 text-sm">
                            <div>
                <span className="block text-xs font-medium text-neutral-400">
                  Make
                </span>
                                <span className="mt-1 block font-semibold text-neutral-800">
                  {vehicle.make}
                </span>
                            </div>
                            <div>
                <span className="block text-xs font-medium text-neutral-400">
                  Model
                </span>
                                <span className="mt-1 block font-semibold text-neutral-800">
                  {vehicle.model}
                </span>
                            </div>
                            <div>
                <span className="block text-xs font-medium text-neutral-400">
                  Year
                </span>
                                <span className="mt-1 block font-semibold text-neutral-800">
                  {vehicle.year}
                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-8 border-b border-neutral-200">
                <nav className="flex gap-8 text-sm font-medium">
                    {(
                        ["Overview", "Maintenance", "Service History", "Documents"] as const
                    ).map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 text-sm transition ${
                                activeTab === tab
                                    ? "border-b-2 border-neutral-900 font-semibold text-neutral-900"
                                    : "text-neutral-500 hover:text-neutral-700"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Overview Cards */}
            <div className="mt-6">
                {activeTab === "Overview" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
              <span className="text-xs font-medium text-neutral-500">
                Predicted Maintenance
              </span>
                            <div className="mt-3 flex items-center gap-3">
                                <Wrench className="h-5 w-5 text-neutral-800" />
                                <div>
                                    <p className="text-sm font-semibold text-neutral-900">
                                        {predLoading ? (
                                            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Forecasting...
                      </span>
                                        ) : prediction ? (
                                            prediction.part
                                        ) : (
                                            "Inspection Required"
                                        )}
                                    </p>
                                    <p
                                        className={`text-xs font-medium ${
                                            prediction ? "text-amber-600" : "text-neutral-400"
                                        }`}
                                    >
                                        {prediction
                                            ? `${Math.round(prediction.probability * 100)}% likelihood`
                                            : "Prediction unavailable"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
              <span className="text-xs font-medium text-neutral-500">
                Last Service
              </span>
                            <div className="mt-3 flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-neutral-800" />
                                <div>
                                    <p className="text-sm font-semibold text-neutral-900">
                                        No service recorded
                                    </p>
                                    <p className="text-xs font-medium text-neutral-400">N/A</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
              <span className="text-xs font-medium text-neutral-500">
                Total Services
              </span>
                            <div className="mt-3 flex items-center gap-3">
                                <FileText className="h-5 w-5 text-neutral-800" />
                                <p className="text-xl font-bold text-neutral-900">0</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
              <span className="text-xs font-medium text-neutral-500">
                Estimated Repair Cost
              </span>
                            <div className="mt-3 flex items-center gap-3">
                                <Tag className="h-5 w-5 text-neutral-800" />
                                <p className="text-xl font-bold text-neutral-900">
                                    {predLoading
                                        ? "..."
                                        : prediction
                                            ? `$${prediction.estimated_cost}`
                                            : "N/A"}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "Maintenance" && (
                    <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
                        Upcoming service predictions and wear forecasts will populate here.
                    </div>
                )}

                {activeTab === "Service History" && (
                    <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
                        No service records found. Log your maintenance tasks to track history.
                    </div>
                )}

                {activeTab === "Documents" && (
                    <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-6 text-center text-sm text-neutral-500">
                        No vehicle documentation or insurance cards uploaded.
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                            <div>
                                <h3 className="text-lg font-semibold text-neutral-900">
                                    Edit Vehicle & Habits
                                </h3>
                                <p className="text-xs text-neutral-500">
                                    Update mileage and driving style to refresh predictions.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="rounded-lg p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="mt-4 space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs font-semibold text-neutral-600">
                                        Year
                                    </label>
                                    <input
                                        type="number"
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm text-neutral-900 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-neutral-600">
                                        Make
                                    </label>
                                    <input
                                        type="text"
                                        value={make}
                                        onChange={(e) => setMake(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm text-neutral-900 focus:outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-neutral-600">
                                        Model
                                    </label>
                                    <input
                                        type="text"
                                        value={model}
                                        onChange={(e) => setModel(e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm text-neutral-900 focus:outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-neutral-600">
                                    Current Mileage (Miles)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={mileage}
                                    onChange={(e) => setMileage(Number(e.target.value))}
                                    className="mt-1 w-full rounded-lg border border-neutral-300 p-2 text-sm text-neutral-900 focus:outline-none"
                                    placeholder="e.g. 74200"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-neutral-600">
                                    Driving Habits
                                </label>
                                <select
                                    value={drivingHabits}
                                    onChange={(e) => setDrivingHabits(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white p-2 text-sm text-neutral-900 focus:outline-none"
                                >
                                    <option value="City Commute">City / Stop-and-Go Commute</option>
                                    <option value="Highway">Highway / Long Distance</option>
                                    <option value="Mixed">Mixed Commute (50/50)</option>
                                    <option value="Severe / Towing">
                                        Severe (Frequent Towing, Mountain Driving)
                                    </option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(false)}
                                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {loading ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}