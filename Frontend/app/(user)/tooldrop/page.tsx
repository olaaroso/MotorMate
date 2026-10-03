import Link from "next/link";
import {
  Search,
  MapPin,
  SlidersHorizontal,
  Wrench,
  Drill,
  CarFront,
  BatteryCharging,
  Gauge,
  ArrowRight,
  Star,
  Package,
  Plus,
  CalendarDays,
} from "lucide-react";

const categories = [
  {
    name: "Hand Tools",
    icon: Wrench,
  },
  {
    name: "Power Tools",
    icon: Drill,
  },
  {
    name: "Lifting",
    icon: CarFront,
  },
  {
    name: "Diagnostics",
    icon: Gauge,
  },
  {
    name: "Electrical",
    icon: BatteryCharging,
  },
];

const tools = [
  {
    name: "3-Ton Floor Jack",
    category: "Lifting",
    price: 18,
    distance: "1.2 miles away",
    rating: 4.9,
    reviews: 24,
    owner: "Mike R.",
    icon: CarFront,
  },
  {
    name: "Cordless Impact Wrench",
    category: "Power Tools",
    price: 14,
    distance: "2.4 miles away",
    rating: 4.8,
    reviews: 18,
    owner: "Alex T.",
    icon: Drill,
  },
  {
    name: "OBD-II Diagnostic Scanner",
    category: "Diagnostics",
    price: 12,
    distance: "3.1 miles away",
    rating: 5.0,
    reviews: 31,
    owner: "Chris M.",
    icon: Gauge,
  },
  {
    name: "Mechanic Tool Set",
    category: "Hand Tools",
    price: 16,
    distance: "3.8 miles away",
    rating: 4.7,
    reviews: 15,
    owner: "Daniel S.",
    icon: Wrench,
  },
];

export default function ToolDropPage() {
  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* HEADER */}

      <section className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-blue-600">
            MotorMate ToolDrop
          </p>

          <h1 className="text-3xl font-bold text-[#001F3F]">
            Rent the tools you need.
          </h1>

          <p className="mt-2 max-w-2xl text-gray-500">
            Find automotive tools available from people nearby without buying
            equipment you may only use once.
          </p>
        </div>

        <Link
          href="/toolListing"
          className="flex items-center justify-center gap-2 rounded-lg bg-[#001F3F] px-5 py-3 font-semibold text-white transition hover:bg-[#003366]"
        >
          <Plus size={18} />
          List Your Tool
        </Link>
      </section>

      {/* SEARCH AREA */}

      <section className="mt-8 rounded-2xl bg-[#001F3F] p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white">
            What tool are you looking for?
          </h2>

          <p className="mt-1 text-sm text-blue-100">
            Search tools available for rent near you.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
          <div className="flex items-center rounded-xl bg-white px-4">
            <Search size={20} className="mr-3 text-gray-400" />

            <input
              type="text"
              placeholder="Search jack, impact wrench, scanner..."
              className="w-full bg-transparent py-4 text-sm text-gray-700 outline-none"
            />
          </div>

          <div className="flex items-center rounded-xl bg-white px-4">
            <MapPin size={19} className="mr-3 text-gray-400" />

            <input
              type="text"
              placeholder="Holtsville, NY"
              className="w-full bg-transparent py-4 text-sm text-gray-700 outline-none"
            />
          </div>

          <button className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-semibold text-[#001F3F] transition hover:bg-gray-100">
            Search
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* CATEGORIES */}

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#001F3F]">
              Browse Categories
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Quickly find the type of equipment you need.
            </p>
          </div>

          <button className="hidden items-center gap-2 text-sm font-semibold text-[#001F3F] md:flex">
            View All
            <ArrowRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {categories.map((category) => {
            const Icon = category.icon;

            return (
              <button
                key={category.name}
                className="group rounded-xl border bg-white p-5 text-left transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F] transition group-hover:bg-[#001F3F] group-hover:text-white">
                  <Icon size={21} />
                </div>

                <p className="mt-4 font-semibold text-gray-900">
                  {category.name}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Browse available tools
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* FEATURED TOOLS */}

      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#001F3F]">
              Tools Near You
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Popular rentals available nearby.
            </p>
          </div>

          <button className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {tools.map((tool) => {
            const Icon = tool.icon;

            return (
              <div
                key={tool.name}
                className="overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg"
              >
                {/* IMAGE PLACEHOLDER */}

                <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                  <Icon size={55} className="text-gray-300" />

                  <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#001F3F] shadow-sm">
                    {tool.category}
                  </span>
                </div>

                {/* DETAILS */}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-gray-900">
                      {tool.name}
                    </h3>

                    <div className="whitespace-nowrap text-right">
                      <span className="text-lg font-bold text-[#001F3F]">
                        ${tool.price}
                      </span>

                      <span className="text-xs text-gray-400">
                        /day
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-sm">
                    <Star
                      size={15}
                      className="fill-amber-400 text-amber-400"
                    />

                    <span className="font-semibold">
                      {tool.rating}
                    </span>

                    <span className="text-gray-400">
                      ({tool.reviews})
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 border-t pt-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin size={15} />
                      {tool.distance}
                    </div>

                    <div className="flex items-center gap-2">
                      <Package size={15} />
                      Listed by {tool.owner}
                    </div>
                  </div>

                  <button className="mt-5 w-full rounded-lg bg-[#001F3F] py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]">
                    View Tool
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* TOOL OWNER CTA */}

      <section className="mt-10 overflow-hidden rounded-2xl border bg-white">
        <div className="grid lg:grid-cols-2">
          <div className="p-8 md:p-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Package size={23} />
            </div>

            <h2 className="mt-5 text-2xl font-bold text-[#001F3F]">
              Have tools sitting in your garage?
            </h2>

            <p className="mt-3 max-w-lg leading-7 text-gray-500">
              Turn unused automotive equipment into extra income. Create a
              ToolDrop listing, choose your rental rate, and manage requests
              directly through MotorMate.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/my-tools"
                className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-5 py-3 font-semibold text-white hover:bg-[#003366]"
              >
                <Plus size={17} />
                List a Tool
              </Link>

              <button className="rounded-lg border px-5 py-3 font-semibold text-[#001F3F] hover:bg-gray-50">
                Learn More
              </button>
            </div>
          </div>

          <div className="flex min-h-72 items-center justify-center bg-[#F4F7FB] p-8">
            <div className="grid w-full max-w-sm grid-cols-2 gap-4">
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <Package className="text-[#001F3F]" />
                <p className="mt-4 text-2xl font-bold text-[#001F3F]">
                  List
                </p>
                <p className="text-sm text-gray-500">
                  Add your equipment
                </p>
              </div>

              <div className="rounded-xl bg-white p-5 shadow-sm">
                <CalendarDays className="text-[#001F3F]" />
                <p className="mt-4 text-2xl font-bold text-[#001F3F]">
                  Rent
                </p>
                <p className="text-sm text-gray-500">
                  Choose availability
                </p>
              </div>

              <div className="col-span-2 rounded-xl bg-[#001F3F] p-5 text-white shadow-sm">
                <p className="text-sm text-blue-100">
                  Tool ownership made useful
                </p>

                <p className="mt-1 text-xl font-bold">
                  Earn from tools you already own.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}