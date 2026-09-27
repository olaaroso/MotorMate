"use client";

import { useState } from "react";
import {
  Plus,
  Wrench,
  CalendarDays,
  FileText,
  Tag,
  Loader2,
  X,
  Car,
  PenTool,
} from "lucide-react";
import { auth } from "@/lib/firebase";

type VehicleData = {
  id?: string;
  name: string;
  mileage: string;
  make: string;
  model: string;
  year: string;
  maintenance: string;
  maintenanceDistance: string;
  lastService: string;
  serviceType: string;
  totalServices: string;
  value: string;
};

const INITIAL_VEHICLES: VehicleData[] = [
  {
    name: "2019 Honda Civic",
    mileage: "74,200 miles",
    make: "Honda",
    model: "Civic",
    year: "2019",
    maintenance: "Oil Change",
    maintenanceDistance: "~1,200 miles",
    lastService: "Aug 12, 2024",
    serviceType: "Oil Change",
    totalServices: "4",
    value: "$14,000",
  },
  {
    name: "2022 Toyota RAV4",
    mileage: "28,500 miles",
    make: "Toyota",
    model: "RAV4",
    year: "2022",
    maintenance: "Tire Rotation",
    maintenanceDistance: "~3,000 miles",
    lastService: "Jun 5, 2024",
    serviceType: "Inspection",
    totalServices: "2",
    value: "$26,000",
  },
];

function titleCase(str: string): string {
  if (!str) return "";
  return str
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
}

export default function GaragePage() {
  const [vehicles, setVehicles] = useState<VehicleData[]>(INITIAL_VEHICLES);

  const [modalType, setModalType] = useState<"tabs" | "vin" | "manual" | null>(null);
  const [activeTab, setActiveTab] = useState<"vin" | "manual">("vin");

  const [vinInput, setVinInput] = useState("");
  const [makeInput, setMakeInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [yearInput, setYearInput] = useState(new Date().getFullYear().toString());
  const [mileageInput, setMileageInput] = useState("50000");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const closeModal = () => {
    setModalType(null);
    setActiveTab("vin");
    setVinInput("");
    setMakeInput("");
    setModelInput("");
    setYearInput(new Date().getFullYear().toString());
    setMileageInput("50000");
    setErrorMsg("");
  };

  const openDualTabModal = () => {
    setActiveTab("vin");
    setErrorMsg("");
    setModalType("tabs");
  };

  const openVinModal = () => {
    setActiveTab("vin");
    setErrorMsg("");
    setModalType("vin");
  };

  const openManualModal = () => {
    setActiveTab("manual");
    setErrorMsg("");
    setModalType("manual");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    const currentUserId = auth.currentUser?.uid || "demo-user-123";
    const mileageNum = parseInt(mileageInput, 10) || 0;

    try {
      let endpoint = `${apiUrl}/api/vin/register`;
      let payload: Record<string, any> = {};

      if (activeTab === "vin") {
        if (!vinInput.trim()) throw new Error("Please enter a valid VIN.");
        endpoint = `${apiUrl}/api/vin/register`;
        payload = {
          vin: vinInput.trim().toUpperCase(),
          owner_id: currentUserId,
          current_mileage: mileageNum,
        };
      } else {
        if (!makeInput.trim() || !modelInput.trim() || !yearInput.trim()) {
          throw new Error("Make, Model, and Year are required.");
        }
        endpoint = `${apiUrl}/api/vin/manual`;
        payload = {
          owner_id: currentUserId,
          make: makeInput.trim(),
          model: modelInput.trim(),
          year: parseInt(yearInput, 10),
          current_mileage: mileageNum,
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Registration failed (${response.status})`);
      }

      const registered = await response.json();
      console.log("Backend response payload:", registered);

      const data =
          registered.vehicle_details ||
          registered.vehicle ||
          registered.data ||
          registered.specs ||
          registered;

      const rawYear = data.year || data.Year || data.model_year || "";
      const rawMake = data.make || data.Make || "Unknown";
      const rawModel = data.model || data.Model || "Vehicle";

      const formattedMake = titleCase(String(rawMake));
      const formattedModel = titleCase(String(rawModel));
      const formattedYear = String(rawYear).trim();

      const newCar: VehicleData = {
        name: formattedYear
            ? `${formattedYear} ${formattedMake} ${formattedModel}`
            : `${formattedMake} ${formattedModel}`,
        mileage: `${mileageNum.toLocaleString()} miles`,
        make: formattedMake,
        model: formattedModel,
        year: formattedYear || "N/A",
        maintenance: "Inspection Required",
        maintenanceDistance: "~500 miles",
        lastService: "Just Added",
        serviceType: "Initial Inspection",
        totalServices: "0",
        value: "Calculating...",
      };

      setVehicles((prev) => [newCar, ...prev]);
      closeModal();
    } catch (err: any) {
      console.error("Registration error:", err);
      setErrorMsg(err.message || "Failed to register vehicle with backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="mx-auto max-w-7xl p-8">
        {/* PAGE HEADER */}
        <section className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#001F3F]">My Garage</h1>
            <p className="mt-1 text-gray-500">
              Manage your vehicles, view details, and track maintenance.
            </p>
          </div>

          <button
              type="button"
              onClick={openDualTabModal}
              className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-5 py-3 font-medium text-white transition hover:bg-[#003366]"
          >
            <Plus size={18} />
            Add Vehicle
          </button>
        </section>

        <div className="space-y-6">
          {vehicles.map((car, idx) => (
              <VehicleGarageCard key={idx} {...car} />
          ))}
        </div>

        {/* ADD VEHICLE BANNER */}
        <section className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#001F3F]">
            <Plus size={32} className="text-[#001F3F]" />
          </div>
          <h2 className="mt-4 text-xl font-bold">Add Another Vehicle</h2>
          <p className="mt-1 text-gray-500">
            Enter your VIN or add a vehicle manually to get started.
          </p>

          <div className="mt-6 flex justify-center gap-4">
            <button
                type="button"
                onClick={openVinModal}
                className="rounded-lg bg-[#001F3F] px-8 py-3 text-white transition hover:bg-[#003366]"
            >
              Add by VIN
            </button>

            <button
                type="button"
                onClick={openManualModal}
                className="rounded-lg bg-gray-200 px-8 py-3 text-gray-700 transition hover:bg-gray-300"
            >
              Add Manually
            </button>
          </div>
        </section>

        {modalType !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b pb-4">
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
                      className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>

                {modalType === "tabs" && (
                    <div className="mt-4 flex rounded-lg bg-gray-100 p-1 text-xs font-semibold">
                      <button
                          type="button"
                          onClick={() => {
                            setActiveTab("vin");
                            setErrorMsg("");
                          }}
                          className={`flex-1 rounded-md py-1.5 transition ${
                              activeTab === "vin"
                                  ? "bg-white text-[#001F3F] shadow-sm"
                                  : "text-gray-500 hover:text-gray-800"
                          }`}
                      >
                        By VIN (Automated)
                      </button>
                      <button
                          type="button"
                          onClick={() => {
                            setActiveTab("manual");
                            setErrorMsg("");
                          }}
                          className={`flex-1 rounded-md py-1.5 transition ${
                              activeTab === "manual"
                                  ? "bg-white text-[#001F3F] shadow-sm"
                                  : "text-gray-500 hover:text-gray-800"
                          }`}
                      >
                        Manual Entry
                      </button>
                    </div>
                )}

                <form onSubmit={handleRegister} className="mt-5 space-y-4">
                  {activeTab === "vin" ? (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                          Vehicle Identification Number (VIN)
                        </label>
                        <input
                            type="text"
                            maxLength={17}
                            placeholder="e.g. 2GKALMEK6F6554869"
                            value={vinInput}
                            onChange={(e) => setVinInput(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 p-3 font-mono text-sm tracking-wider uppercase focus:border-[#001F3F] focus:outline-none focus:ring-1 focus:ring-[#001F3F]"
                            required
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Must be a valid 17-character VIN decoded via NHTSA.
                        </p>
                      </div>
                  ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                              Make
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Ford"
                                value={makeInput}
                                onChange={(e) => setMakeInput(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-[#001F3F] focus:outline-none"
                                required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                              Model
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Mustang"
                                value={modelInput}
                                onChange={(e) => setModelInput(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-[#001F3F] focus:outline-none"
                                required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                            Model Year
                          </label>
                          <input
                              type="number"
                              min={1900}
                              max={2100}
                              placeholder="e.g. 2021"
                              value={yearInput}
                              onChange={(e) => setYearInput(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-[#001F3F] focus:outline-none"
                              required
                          />
                        </div>
                      </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Current Odometer (Miles)
                    </label>
                    <input
                        type="number"
                        placeholder="e.g. 54000"
                        value={mileageInput}
                        onChange={(e) => setMileageInput(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-[#001F3F] focus:outline-none focus:ring-1 focus:ring-[#001F3F]"
                    />
                  </div>

                  {errorMsg && (
                      <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                        {errorMsg}
                      </div>
                  )}

                  <div className="flex justify-end gap-3 pt-3">
                    <button
                        type="button"
                        onClick={closeModal}
                        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || (activeTab === "vin" && vinInput.length < 11)}
                        className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#003366] disabled:opacity-50"
                    >
                      {loading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            {activeTab === "vin" ? "Decoding VIN..." : "Saving..."}
                          </>
                      ) : activeTab === "vin" ? (
                          "Register Car"
                      ) : (
                          "Add Car"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
}

type VehicleGarageCardProps = VehicleData;

function VehicleGarageCard({
                             name,
                             mileage,
                             make,
                             model,
                             year,
                             maintenance,
                             maintenanceDistance,
                             lastService,
                             serviceType,
                             totalServices,
                             value,
                           }: VehicleGarageCardProps) {
  return (
      <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="flex h-40 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400 md:w-56">
            Vehicle Image
          </div>

          <div className="flex-1">
            <div className="flex justify-between">
              <div>
                <h2 className="text-2xl font-bold">{name}</h2>
                <p className="text-gray-500">{mileage}</p>
              </div>
              <button className="h-fit rounded bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200">
                Edit
              </button>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-500">Make</p>
                <p className="font-medium">{make}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Model</p>
                <p className="font-medium">{model}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Year</p>
                <p className="font-medium">{year}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-8 border-b text-sm">
          <button className="border-b-2 border-[#001F3F] pb-3 font-semibold text-[#001F3F]">
            Overview
          </button>
          <button className="pb-3 text-gray-500">Maintenance</button>
          <button className="pb-3 text-gray-500">Service History</button>
          <button className="pb-3 text-gray-500">Documents</button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <GarageInfoCard title="Next Maintenance" icon={Wrench}>
            <p className="font-medium">{maintenance}</p>
            <p className="text-sm text-amber-600">{maintenanceDistance}</p>
          </GarageInfoCard>

          <GarageInfoCard title="Last Service" icon={CalendarDays}>
            <p className="font-medium">{lastService}</p>
            <p className="text-sm text-gray-500">{serviceType}</p>
          </GarageInfoCard>

          <GarageInfoCard title="Total Services" icon={FileText}>
            <p className="text-2xl font-semibold">{totalServices}</p>
          </GarageInfoCard>

          <GarageInfoCard title="Estimated Value" icon={Tag}>
            <p className="text-2xl font-semibold">{value}</p>
          </GarageInfoCard>
        </div>
      </section>
  );
}

type GarageInfoCardProps = {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
};

function GarageInfoCard({ title, icon: Icon, children }: GarageInfoCardProps) {
  return (
      <div className="rounded-lg bg-gray-100 p-4">
        <p className="text-xs text-gray-500">{title}</p>
        <div className="mt-3 flex gap-3">
          <Icon size={22} className="shrink-0 text-[#001F3F]" />
          <div>{children}</div>
        </div>
      </div>
  );
}