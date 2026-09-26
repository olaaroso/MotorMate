"use client";

import { useState } from "react";

// Placeholder shape for what the VIN decode endpoint will eventually return.
// Swap this out once backend defines the real response format.
type DecodedVehicle = {
  make: string;
  model: string;
  year: string;
  trim: string;
  bodyType: string;
};

const EXAMPLE_VEHICLE: DecodedVehicle = {
  make: "Honda",
  model: "Civic",
  year: "2015",
  trim: "EX",
  bodyType: "Sedan",
};

export default function GaragePage() {
  const [vin, setVin] = useState("");
  const [vehicle, setVehicle] = useState<DecodedVehicle | null>(null);
  const [error, setError] = useState("");

  function handleLookup() {
    setError("");

    if (vin.trim().length !== 17) {
      setError("VINs are 17 characters long. Double-check and try again.");
      setVehicle(null);
      return;
    }

    // TODO: replace with a real call to the VIN decode endpoint once
    // backend has it ready. Using example data for now so the UI can
    // be built and reviewed ahead of that.
    setVehicle(EXAMPLE_VEHICLE);
  }

  return (
    <div className="min-h-screen w-full bg-[#F8F8FF]">

      {/* NAVBAR */}
      <header className="bg-[#001F3F] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <div className="text-xl font-semibold">MotorMate</div>

          <nav className="flex items-center gap-10 text-sm font-medium">
            <a href="#" className="text-gray-300">Dashboard</a>
            <a href="#" className="border-b-2 border-white pb-1">Garage</a>
            <a href="#" className="text-gray-300">Tools</a>
            <div className="flex items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-[#001F3F]">
                JA
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="mx-auto max-w-6xl px-8 py-10">

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#001F3F]">
            My Garage
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Add a vehicle by entering its VIN to pull its make, model, and
            specs.
          </p>
        </div>

        {/* VIN LOOKUP CARD */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-[#001F3F]">
            Add a vehicle
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter your 17-character Vehicle Identification Number (VIN).
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="e.g. 1HGCM82633A004352"
              maxLength={17}
              className="w-full flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 font-mono text-sm tracking-wide text-[#001F3F] placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-400 focus:border-[#001F3F] focus:outline-none focus:ring-1 focus:ring-[#001F3F]"
            />
            <button
              onClick={handleLookup}
              className="whitespace-nowrap rounded-lg bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a2c52] focus:outline-none focus:ring-2 focus:ring-[#001F3F] focus:ring-offset-2"
            >
              Look up vehicle
            </button>
          </div>

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* DECODED VEHICLE RESULT */}
        {vehicle && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Found a match
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[#001F3F]">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h3>
                <p className="text-sm text-gray-500">
                  {vehicle.trim} · {vehicle.bodyType}
                </p>
              </div>
              <span className="rounded-full bg-[#F8F8FF] px-3 py-1 text-xs font-medium text-[#001F3F]">
                VIN {vin}
              </span>
            </div>

            <div className="mt-5 flex gap-3">
              <button className="rounded-lg bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2c52]">
                Save to my garage
              </button>
              <button
                onClick={() => {
                  setVehicle(null);
                  setVin("");
                }}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-[#001F3F] hover:bg-gray-50"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* SAVED VEHICLES */}
        <div className="mt-10">
          <h2 className="text-base font-semibold text-[#001F3F]">
            Your vehicles
          </h2>

          {/* Empty state — swap for a grid of vehicle cards once vehicles are saved */}
          <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-[#001F3F]">
              No vehicles yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Look up a VIN above and save it to see it here.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}