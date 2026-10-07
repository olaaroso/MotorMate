"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ElementType,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Car,
  CircleDollarSign,
  Loader2,
  PenTool,
  Plus,
  X,
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/lib/firebase";
import VehicleCard, {
  type PredictionItem,
  type Vehicle,
} from "../../../components/VehicleCard";

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

function titleCase(value: string) {
  if (!value) return "";

  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

type RawVehicle = {
  _id?: string;
  id?: string;
  vehicle_id?: string;

  owner_id?: string;

  vin?: string | null;

  make?: string;
  Make?: string;

  model?: string;
  Model?: string;

  year?: number | string;
  ModelYear?: number | string;

  current_mileage?: number | string;

  driving_habits?: string;

  created_at?: string;
};

function normalizeVehicle(rawVehicle: RawVehicle): Vehicle {
  const rawYear = Number(rawVehicle.year || rawVehicle.ModelYear);

  return {
    _id: rawVehicle._id || rawVehicle.id || rawVehicle.vehicle_id,
    id: rawVehicle.id || rawVehicle._id || rawVehicle.vehicle_id,
    owner_id: rawVehicle.owner_id,
    vin: rawVehicle.vin || null,
    make: titleCase(String(rawVehicle.make || rawVehicle.Make || "Unknown")),
    model: titleCase(String(rawVehicle.model || rawVehicle.Model || "Vehicle")),
    year: rawYear || new Date().getFullYear(),
    current_mileage: Number(rawVehicle.current_mileage) || 0,
    driving_habits: rawVehicle.driving_habits || "City Commute",
    created_at: rawVehicle.created_at,
  };
}

function getVehicleId(vehicle: Vehicle) {
  return vehicle._id || vehicle.id || "";
}

export default function GaragePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [predictions, setPredictions] = useState<
    Record<string, PredictionItem | null>
  >({});
  const [garageLoading, setGarageLoading] = useState(true);

  const [modalType, setModalType] = useState<
    "tabs" | "vin" | "manual" | null
  >(null);
  const [activeTab, setActiveTab] = useState<"vin" | "manual">("vin");

  const [vinInput, setVinInput] = useState("");
  const [makeInput, setMakeInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [yearInput, setYearInput] = useState(
    new Date().getFullYear().toString()
  );
  const [mileageInput, setMileageInput] = useState("50000");
  const [drivingHabitsInput, setDrivingHabitsInput] =
    useState("City Commute");

  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setVehicles([]);
        setPredictions({});
        setGarageLoading(false);
        return;
      }

      try {
        setGarageLoading(true);

        const response = await fetch(
          `${apiUrl}/api/vin/vehicles/${user.uid}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.detail || "Failed to load saved vehicles."
          );
        }

        const result = await response.json();
        const savedVehicles = (result.vehicles || []).map(normalizeVehicle);

        setVehicles(savedVehicles);
        setPredictions({});
      } catch (error) {
        console.error("Failed to load garage:", error);
        setVehicles([]);
        setPredictions({});
      } finally {
        setGarageLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const closeModal = () => {
    setModalType(null);
    setActiveTab("vin");
    setVinInput("");
    setMakeInput("");
    setModelInput("");
    setYearInput(new Date().getFullYear().toString());
    setMileageInput("50000");
    setDrivingHabitsInput("City Commute");
    setRegisterError("");
  };

  const openDualTabModal = () => {
    setActiveTab("vin");
    setRegisterError("");
    setModalType("tabs");
  };

  const openVinModal = () => {
    setActiveTab("vin");
    setRegisterError("");
    setModalType("vin");
  };

  const openManualModal = () => {
    setActiveTab("manual");
    setRegisterError("");
    setModalType("manual");
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setRegisterError("You must be signed in to add a vehicle.");
      return;
    }

    const mileage = Number.parseInt(mileageInput, 10) || 0;

    if (mileage < 0) {
      setRegisterError("Mileage cannot be negative.");
      return;
    }

    setRegisterLoading(true);
    setRegisterError("");

    try {
      let endpoint = `${apiUrl}/api/vin/register`;
      let payload: Record<string, string | number>;

      if (activeTab === "vin") {
        const vin = vinInput.trim().toUpperCase();

        if (vin.length !== 17) {
          throw new Error("VIN must be exactly 17 characters long.");
        }

        payload = {
          vin,
          owner_id: currentUser.uid,
          current_mileage: mileage,
          driving_habits: drivingHabitsInput,
        };
      } else {
        const year = Number.parseInt(yearInput, 10);

        if (!makeInput.trim() || !modelInput.trim()) {
          throw new Error("Make and model are required.");
        }

        if (!year || year < 1900 || year > 2100) {
          throw new Error("Please enter a valid model year.");
        }

        endpoint = `${apiUrl}/api/vin/manual`;
        payload = {
          owner_id: currentUser.uid,
          make: makeInput.trim(),
          model: modelInput.trim(),
          year,
          current_mileage: mileage,
          driving_habits: drivingHabitsInput,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Registration failed (${response.status})`
        );
      }

      const registered = await response.json();
      const vehicleData =
        registered.vehicle_details ||
        registered.vehicle ||
        registered.data ||
        registered.specs ||
        registered;

      const newVehicle = normalizeVehicle({
        ...vehicleData,
        _id: vehicleData._id || registered.vehicle_id,
        owner_id: vehicleData.owner_id || currentUser.uid,
        current_mileage:
          vehicleData.current_mileage === undefined
            ? mileage
            : vehicleData.current_mileage,
        driving_habits:
          vehicleData.driving_habits || drivingHabitsInput,
      });

      setVehicles((previous) => {
        const newVehicleId = getVehicleId(newVehicle);
        const alreadyExists = previous.some((vehicle) => {
          const existingId = getVehicleId(vehicle);

          return (
            (newVehicleId && existingId === newVehicleId) ||
            (vehicle.vin && newVehicle.vin && vehicle.vin === newVehicle.vin)
          );
        });

        if (alreadyExists) return previous;
        return [newVehicle, ...previous];
      });

      closeModal();
    } catch (error) {
      console.error("Registration error:", error);
      setRegisterError(
        error instanceof Error ? error.message : "Failed to register vehicle."
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleVehicleUpdated = useCallback((updatedVehicle: Vehicle) => {
    const normalized = normalizeVehicle(updatedVehicle);
    const updatedId = getVehicleId(normalized);

    setVehicles((previous) =>
      previous.map((vehicle) =>
        getVehicleId(vehicle) === updatedId ? normalized : vehicle
      )
    );
  }, []);

  const handleVehicleRemoved = useCallback((vehicleId: string) => {
    setVehicles((previous) =>
      previous.filter((vehicle) => getVehicleId(vehicle) !== vehicleId)
    );

    setPredictions((previous) => {
      if (!(vehicleId in previous)) return previous;

      const next = { ...previous };
      delete next[vehicleId];
      return next;
    });
  }, []);

  const handlePredictionUpdated = useCallback(
    (vehicleId: string, prediction: PredictionItem | null) => {
      setPredictions((previous) => {
        const current = previous[vehicleId];

        if (
          current?.part === prediction?.part &&
          current?.probability === prediction?.probability &&
          current?.estimated_cost === prediction?.estimated_cost
        ) {
          return previous;
        }

        if (current === null && prediction === null) {
          return previous;
        }

        return {
          ...previous,
          [vehicleId]: prediction,
        };
      });
    },
    []
  );

  const predictionSummary = useMemo(() => {
    const loadedPredictions = Object.values(predictions).filter(
      (prediction): prediction is PredictionItem => Boolean(prediction)
    );

    const alerts = loadedPredictions.filter(
      (prediction) => prediction.part !== "None expected soon"
    ).length;

    const estimatedRepairs = loadedPredictions.reduce(
      (total, prediction) => total + Number(prediction.estimated_cost || 0),
      0
    );

    return { alerts, estimatedRepairs };
  }, [predictions]);

  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#001F3F] sm:text-4xl">
            My Garage
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Manage your vehicles, driving habits, and records.
          </p>
        </div>

        <button
          type="button"
          onClick={openDualTabModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#003366] hover:shadow-md active:translate-y-0"
        >
          <Plus size={18} />
          Add Vehicle
        </button>
      </section>

      {!garageLoading && (
        <GarageSummary
          vehicleCount={vehicles.length}
          maintenanceAlerts={predictionSummary.alerts}
          estimatedRepairTotal={predictionSummary.estimatedRepairs}
        />
      )}

      {garageLoading && (
        <div className="mt-8 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>

          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 text-slate-500 shadow-sm">
            <Loader2 size={22} className="mr-3 animate-spin text-[#001F3F]" />
            Loading your garage...
          </div>
        </div>
      )}

      {!garageLoading && vehicles.length === 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-[#001F3F]">
            <Car size={32} />
          </div>

          <h2 className="mt-5 text-xl font-bold text-[#001F3F]">
            Your garage is empty
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Add your first vehicle to begin tracking mileage, driving habits,
            maintenance predictions, and repair information.
          </p>

          <button
            type="button"
            onClick={openDualTabModal}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#003366]"
          >
            <Plus size={17} />
            Add Your First Vehicle
          </button>
        </div>
      )}

      {!garageLoading && vehicles.length > 0 && (
        <div className="mt-8 space-y-6">
          {vehicles.map((vehicle) => (
            <VehicleCard
              key={getVehicleId(vehicle) || vehicle.vin || `${vehicle.year}-${vehicle.make}-${vehicle.model}`}
              vehicle={vehicle}
              onVehicleUpdated={handleVehicleUpdated}
              onVehicleRemoved={handleVehicleRemoved}
              onPredictionUpdated={handlePredictionUpdated}
            />
          ))}
        </div>
      )}

      <section className="relative mt-8 overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-linear-to-br from-white to-slate-50 px-6 py-12 text-center">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-[#001F3F]/5 blur-3xl" />

        <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#001F3F] text-white shadow-md">
          <Plus size={26} />
        </div>

        <h2 className="relative mt-5 text-xl font-bold text-slate-900">
          Add another vehicle
        </h2>

        <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Decode your VIN automatically or enter your vehicle details manually.
        </p>

        <div className="relative mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={openVinModal}
            className="rounded-xl bg-[#001F3F] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#003366] hover:shadow-md"
          >
            Add by VIN
          </button>

          <button
            type="button"
            onClick={openManualModal}
            className="rounded-xl border border-slate-200 bg-white px-7 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:shadow-sm"
          >
            Add Manually
          </button>
        </div>
      </section>

      {modalType !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                {activeTab === "vin" ? (
                  <Car className="text-[#001F3F]" size={22} />
                ) : (
                  <PenTool className="text-[#001F3F]" size={20} />
                )}

                <h3 className="text-lg font-bold text-[#001F3F]">
                  {modalType === "tabs"
                    ? "Add New Vehicle"
                    : modalType === "vin"
                      ? "Register Vehicle by VIN"
                      : "Add Vehicle Manually"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close add vehicle"
              >
                <X size={20} />
              </button>
            </div>

            {modalType === "tabs" && (
              <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("vin");
                    setRegisterError("");
                  }}
                  className={`flex-1 rounded-lg py-2 transition ${
                    activeTab === "vin"
                      ? "bg-white text-[#001F3F] shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  By VIN
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("manual");
                    setRegisterError("");
                  }}
                  className={`flex-1 rounded-lg py-2 transition ${
                    activeTab === "manual"
                      ? "bg-white text-[#001F3F] shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Manual Entry
                </button>
              </div>
            )}

            <form onSubmit={handleRegister} className="mt-5 space-y-4">
              {activeTab === "vin" ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Vehicle Identification Number (VIN)
                  </label>
                  <input
                    type="text"
                    maxLength={17}
                    placeholder="e.g. TRUTC28N831014295"
                    value={vinInput}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setVinInput(event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-mono text-sm tracking-wider uppercase outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                    required
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Must be a valid 17-character VIN decoded through NHTSA.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Make
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Ford"
                        value={makeInput}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setMakeInput(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Model
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mustang"
                        value={modelInput}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setModelInput(event.target.value)
                        }
                        className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Model Year
                    </label>
                    <input
                      type="number"
                      min={1900}
                      max={2100}
                      value={yearInput}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setYearInput(event.target.value)
                    }
                      className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Current Odometer (Miles)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 54000"
                  value={mileageInput}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setMileageInput(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Driving Habits
                </label>
                <select
                  value={drivingHabitsInput}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    setDrivingHabitsInput(event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm outline-none transition focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                >
                  {DRIVING_HABITS.map((habit) => (
                    <option key={habit.value} value={habit.value}>
                      {habit.label}
                    </option>
                  ))}
                </select>
              </div>

              {registerError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  {registerError}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={registerLoading}
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    registerLoading ||
                    (activeTab === "vin" && vinInput.trim().length !== 17)
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:opacity-50"
                >
                  {registerLoading && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {registerLoading
                    ? activeTab === "vin"
                      ? "Decoding VIN..."
                      : "Saving..."
                    : activeTab === "vin"
                      ? "Register Car"
                      : "Add Car"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GarageSummary({
  vehicleCount,
  maintenanceAlerts,
  estimatedRepairTotal,
}: {
  vehicleCount: number;
  maintenanceAlerts: number;
  estimatedRepairTotal: number;
}) {
  return (
    <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      <GarageSummaryCard
        label="Vehicles"
        value={vehicleCount.toString()}
        description="Saved in your garage"
        icon={Car}
      />

      <GarageSummaryCard
        label="Maintenance Alerts"
        value={maintenanceAlerts.toString()}
        description={
          maintenanceAlerts === 1
            ? "Vehicle may need attention"
            : "Vehicles may need attention"
        }
        icon={AlertTriangle}
      />

      <GarageSummaryCard
        label="Estimated Repairs"
        value={
          estimatedRepairTotal > 0
            ? `$${estimatedRepairTotal.toLocaleString()}`
            : "$0"
        }
        description="Based on loaded predictions"
        icon={CircleDollarSign}
      />
    </section>
  );
}

function GarageSummaryCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: ElementType;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#001F3F]/5 text-[#001F3F]">
        <Icon size={22} />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
