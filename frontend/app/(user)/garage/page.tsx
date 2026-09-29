import {
  Plus,
  Wrench,
  CalendarDays,
  FileText,
  Tag,
} from "lucide-react";

export default function GaragePage() {
  return (
    <div className="mx-auto max-w-7xl p-8">

      {/* PAGE HEADER */}

      <section className="flex items-start justify-between">

        <div>

          <h1 className="text-3xl font-bold text-[#001F3F]">
            My Garage
          </h1>

          <p className="mt-1 text-gray-500">
            Manage your vehicles, view details, and track maintenance.
          </p>

        </div>


        <button className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-5 py-3 font-medium text-white hover:bg-[#003366]">

          <Plus size={18} />

          Add Vehicle

        </button>

      </section>


      {/* HONDA */}

      <VehicleGarageCard
        name="2019 Honda Civic"
        mileage="74,200 miles"
        make="Honda"
        model="Civic"
        year="2019"
        maintenance="Oil Change"
        maintenanceDistance="~1,200 miles"
        lastService="Aug 12, 2024"
        serviceType="Oil Change"
        totalServices="4"
        value="$14,000"
      />


      {/* TOYOTA */}

      <VehicleGarageCard
        name="2022 Toyota RAV4"
        mileage="28,500 miles"
        make="Toyota"
        model="RAV4"
        year="2022"
        maintenance="Tire Rotation"
        maintenanceDistance="~3,000 miles"
        lastService="Jun 5, 2024"
        serviceType="Inspection"
        totalServices="2"
        value="$26,000"
      />


      {/* ADD VEHICLE */}

      <section className="mt-8 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#001F3F]">

          <Plus
            size={32}
            className="text-[#001F3F]"
          />

        </div>

        <h2 className="mt-4 text-xl font-bold">
          Add Another Vehicle
        </h2>

        <p className="mt-1 text-gray-500">
          Enter your VIN or add a vehicle manually to get started.
        </p>

        <div className="mt-6 flex justify-center gap-4">

          <button className="rounded-lg bg-[#001F3F] px-8 py-3 text-white hover:bg-[#003366]">
            Add by VIN
          </button>

          <button className="rounded-lg bg-gray-200 px-8 py-3 hover:bg-gray-300">
            Add Manually
          </button>

        </div>

      </section>

    </div>
  );
}



type VehicleGarageCardProps = {
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
    <section className="mt-8 rounded-xl border bg-white p-6">

      {/* VEHICLE HEADER */}

      <div className="flex flex-col gap-6 md:flex-row">

        <div className="flex h-40 w-full items-center justify-center rounded-lg bg-gray-100 text-gray-400 md:w-56">
          Vehicle Image
        </div>


        <div className="flex-1">

          <div className="flex justify-between">

            <div>

              <h2 className="text-2xl font-bold">
                {name}
              </h2>

              <p className="text-gray-500">
                {mileage}
              </p>

            </div>

            <button className="h-fit rounded bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200">
              Edit
            </button>

          </div>


          <div className="mt-6 grid grid-cols-3 gap-6">

            <div>
              <p className="text-xs text-gray-500">
                Make
              </p>

              <p className="font-medium">
                {make}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                Model
              </p>

              <p className="font-medium">
                {model}
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                Year
              </p>

              <p className="font-medium">
                {year}
              </p>
            </div>

          </div>

        </div>

      </div>


      {/* TABS */}

      <div className="mt-6 flex gap-8 border-b text-sm">

        <button className="border-b-2 border-[#001F3F] pb-3 font-semibold text-[#001F3F]">
          Overview
        </button>

        <button className="pb-3 text-gray-500">
          Maintenance
        </button>

        <button className="pb-3 text-gray-500">
          Service History
        </button>

        <button className="pb-3 text-gray-500">
          Documents
        </button>

      </div>


      {/* VEHICLE STATS */}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">

        <GarageInfoCard
          title="Next Maintenance"
          icon={Wrench}
        >
          <p className="font-medium">
            {maintenance}
          </p>

          <p className="text-sm text-amber-600">
            {maintenanceDistance}
          </p>
        </GarageInfoCard>


        <GarageInfoCard
          title="Last Service"
          icon={CalendarDays}
        >

          <p className="font-medium">
            {lastService}
          </p>

          <p className="text-sm text-gray-500">
            {serviceType}
          </p>

        </GarageInfoCard>


        <GarageInfoCard
          title="Total Services"
          icon={FileText}
        >

          <p className="text-2xl font-semibold">
            {totalServices}
          </p>

        </GarageInfoCard>


        <GarageInfoCard
          title="Estimated Value"
          icon={Tag}
        >

          <p className="text-2xl font-semibold">
            {value}
          </p>

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


function GarageInfoCard({
  title,
  icon: Icon,
  children,
}: GarageInfoCardProps) {

  return (
    <div className="rounded-lg bg-gray-100 p-4">

      <p className="text-xs text-gray-500">
        {title}
      </p>

      <div className="mt-3 flex gap-3">

        <Icon
          size={22}
          className="shrink-0 text-[#001F3F]"
        />

        <div>
          {children}
        </div>

      </div>

    </div>
  );
}