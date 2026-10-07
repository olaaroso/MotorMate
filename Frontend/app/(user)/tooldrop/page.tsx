"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  ChevronDown,
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
  Loader2,
  Check,
} from "lucide-react";

interface ToolItem {
  id?: string;
  item_name: string;
  category: string;
  price: number;
  distance: number | string;
  rating: number;
  reviews: number;
  seller_name: string;
  owner?: string;
}

const CATEGORIES = [
  { name: "Hand Tools", icon: Wrench },
  { name: "Power Tools", icon: Drill },
  { name: "Lifting", icon: CarFront },
  { name: "Diagnostics", icon: Gauge },
  { name: "Electrical", icon: BatteryCharging },
];

const SORT_OPTIONS = [
  { id: "featured", label: "Featured", field: "featured", order: "desc" },
  { id: "dist_asc", label: "Distance: Nearest First", field: "distance", order: "asc" },
  { id: "dist_desc", label: "Distance: Furthest First", field: "distance", order: "desc" },
  { id: "price_asc", label: "Price: Low to High", field: "price", order: "asc" },
  { id: "price_desc", label: "Price: High to Low", field: "price", order: "desc" },
];

const DEFAULT_TOOLS: ToolItem[] = [
  {
    id: "1",
    item_name: "3-Ton Floor Jack",
    category: "Lifting",
    price: 18,
    distance: 1.2,
    rating: 4.9,
    reviews: 24,
    seller_name: "Mike R.",
  },
  {
    id: "2",
    item_name: "Cordless Impact Wrench",
    category: "Power Tools",
    price: 14,
    distance: 2.4,
    rating: 4.8,
    reviews: 18,
    seller_name: "Alex T.",
  },
  {
    id: "3",
    item_name: "OBD-II Diagnostic Scanner",
    category: "Diagnostics",
    price: 12,
    distance: 3.1,
    rating: 5.0,
    reviews: 31,
    seller_name: "Chris M.",
  },
  {
    id: "4",
    item_name: "Mechanic Tool Set",
    category: "Hand Tools",
    price: 16,
    distance: 3.8,
    rating: 4.7,
    reviews: 15,
    seller_name: "Daniel S.",
  },
];

export default function ToolDropPage() {
  const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const [tools, setTools] = useState<ToolItem[]>(DEFAULT_TOOLS);
  const [loading, setLoading] = useState(false);

  const [activeSortId, setActiveSortId] = useState("featured");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const currentSort =
      SORT_OPTIONS.find((opt) => opt.id === activeSortId) || SORT_OPTIONS[0];

  const fetchTools = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort_by: currentSort.field,
        order: currentSort.order,
      });

      if (selectedCategory) {
        params.append("category", selectedCategory);
      }
      if (appliedSearch.trim()) {
        params.append("search", appliedSearch.trim());
      }

      const res = await fetch(`${apiUrl}/api/diy/listings?${params.toString()}`);

      if (!res.ok) {
        let local = [...DEFAULT_TOOLS];
        if (selectedCategory) {
          local = local.filter(
              (t) => t.category.toLowerCase() === selectedCategory.toLowerCase()
          );
        }
        if (appliedSearch.trim()) {
          local = local.filter((t) =>
              t.item_name.toLowerCase().includes(appliedSearch.toLowerCase())
          );
        }
        if (currentSort.field !== "featured") {
          local.sort((a, b) => {
            const valA = Number(currentSort.field === "price" ? a.price : a.distance);
            const valB = Number(currentSort.field === "price" ? b.price : b.distance);
            return currentSort.order === "asc" ? valA - valB : valB - valA;
          });
        }
        setTools(local);
        return;
      }

      const data = await res.json();
      if (Array.isArray(data.results)) {
        setTools(data.results);
      }
    } catch {
      // Graceful local sort on network error
      let local = [...DEFAULT_TOOLS];
      if (selectedCategory) {
        local = local.filter(
            (t) => t.category.toLowerCase() === selectedCategory.toLowerCase()
        );
      }
      if (currentSort.field !== "featured") {
        local.sort((a, b) => {
          const valA = Number(currentSort.field === "price" ? a.price : a.distance);
          const valB = Number(currentSort.field === "price" ? b.price : b.distance);
          return currentSort.order === "asc" ? valA - valB : valB - valA;
        });
      }
      setTools(local);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, currentSort, selectedCategory, appliedSearch]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput);
  };

  const toggleCategory = (catName: string) => {
    setSelectedCategory((prev) => (prev === catName ? null : catName));
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case "power tools":
        return Drill;
      case "lifting":
        return CarFront;
      case "diagnostics":
        return Gauge;
      case "electrical":
        return BatteryCharging;
      default:
        return Wrench;
    }
  };

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

          <form
              onSubmit={handleSearchSubmit}
              className="grid gap-3 lg:grid-cols-[1fr_260px_auto]"
          >
            <div className="flex items-center rounded-xl bg-white px-4">
              <Search size={20} className="mr-3 text-gray-400" />
              <input
                  type="text"
                  placeholder="Search jack, impact wrench, scanner..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-transparent py-4 text-sm text-gray-700 outline-none"
              />
            </div>

            <div className="flex items-center rounded-xl bg-white px-4">
              <MapPin size={19} className="mr-3 text-gray-400" />
              <input
                  type="text"
                  defaultValue="Farmingdale, NY"
                  className="w-full bg-transparent py-4 text-sm text-gray-700 outline-none"
              />
            </div>

            <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-semibold text-[#001F3F] transition hover:bg-gray-100"
            >
              Search
              <ArrowRight size={17} />
            </button>
          </form>
        </section>

        {/* BROWSE CATEGORIES */}
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

            <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className={`hidden items-center gap-2 text-sm font-semibold md:flex transition ${
                    selectedCategory === null
                        ? "text-gray-400 cursor-default"
                        : "text-[#001F3F] hover:underline cursor-pointer"
                }`}
            >
              View All
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.name;

              return (
                  <button
                      key={category.name}
                      type="button"
                      onClick={() => toggleCategory(category.name)}
                      className={`group rounded-xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-md ${
                          isSelected
                              ? "border-[#001F3F] bg-blue-50/50 shadow-sm ring-1 ring-[#001F3F]"
                              : "border-gray-200 bg-white hover:border-blue-200"
                      }`}
                  >
                    <div
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                            isSelected
                                ? "bg-[#001F3F] text-white"
                                : "bg-blue-50 text-[#001F3F] group-hover:bg-[#001F3F] group-hover:text-white"
                        }`}
                    >
                      <Icon size={21} />
                    </div>

                    <p className="mt-4 font-semibold text-gray-900">
                      {category.name}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      {isSelected ? "Filter active (Click to reset)" : "Browse available tools"}
                    </p>
                  </button>
              );
            })}
          </div>
        </section>

        {/* TOOLS DIRECTORY & SORT CONTROLS */}
        <section className="mt-10">
          <div className="relative z-30 mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#001F3F]">
                Tools Near You
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedCategory ? (
                    <span>
            Showing category:{" "}
                      <strong className="text-gray-800">{selectedCategory}</strong>
          </span>
                ) : (
                    "Popular rentals available nearby."
                )}
              </p>
            </div>

            {/* SORT BUTTON & POPOVER */}
            <div className="relative">
              <button
                  type="button"
                  onClick={() => setShowFilters((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
              >
        <span>
          Sort by:{" "}
          <span className="font-semibold text-gray-900">
            {currentSort.label}
          </span>
        </span>
                <ChevronDown
                    size={14}
                    className={`text-gray-400 transition-transform duration-200 ${
                        showFilters ? "rotate-180" : ""
                    }`}
                />
              </button>

              {/* DROPDOWN */}
              {showFilters && (
                  <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowFilters(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-2 min-w-[270px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1.5 shadow-2xl">
                      {SORT_OPTIONS.map((opt) => {
                        const isSelected = activeSortId === opt.id;
                        return (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setActiveSortId(opt.id);
                                  setShowFilters(false);
                                }}
                                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                                    isSelected
                                        ? "border-l-4 border-[#001F3F] bg-blue-50/70 font-semibold text-[#001F3F]"
                                        : "border-l-4 border-transparent text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                              <span className="whitespace-nowrap">{opt.label}</span>
                              {isSelected && (
                                  <Check size={16} className="ml-3 shrink-0 text-[#001F3F]" />
                              )}
                            </button>
                        );
                      })}

                      {selectedCategory && (
                          <div className="mt-2 border-t border-gray-100 p-2">
                            <button
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(null);
                                  setShowFilters(false);
                                }}
                                className="w-full rounded-md py-1 text-center text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Clear Category Filter ({selectedCategory})
                            </button>
                          </div>
                      )}
                    </div>
                  </>
              )}
            </div>
          </div>

          {/* TOOL CARDS GRID */}
          {loading ? (
              <div className="flex h-56 w-full items-center justify-center rounded-2xl border bg-white">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
          ) : tools.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <Package size={36} className="mx-auto text-gray-300" />
                <h3 className="mt-3 text-base font-semibold text-gray-800">
                  No equipment found
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Try adjusting your search criteria or resetting the category filter.
                </p>
              </div>
          ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {tools.map((tool) => {
                  const Icon = getCategoryIcon(tool.category);

                  return (
                      <div
                          key={tool.id || tool.item_name}
                          className="overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                          <Icon size={55} className="text-gray-300" />

                          <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#001F3F] shadow-sm">
                      {tool.category}
                    </span>
                        </div>

                        <div className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-gray-900 line-clamp-1">
                              {tool.item_name}
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
                              {typeof tool.distance === "number"
                                  ? `${tool.distance} miles away`
                                  : tool.distance}
                            </div>

                            <div className="flex items-center gap-2">
                              <Package size={15} />
                              Listed by {tool.seller_name || tool.owner}
                            </div>
                          </div>

                          <button
                              type="button"
                              className="mt-5 w-full rounded-lg bg-[#001F3F] py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]"
                          >
                            View Tool
                          </button>
                        </div>
                      </div>
                  );
                })}
              </div>
          )}
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
                    href="/toolListing"
                    className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-5 py-3 font-semibold text-white hover:bg-[#003366]"
                >
                  <Plus size={17} />
                  List a Tool
                </Link>

                <button
                    type="button"
                    className="rounded-lg border px-5 py-3 font-semibold text-[#001F3F] hover:bg-gray-50"
                >
                  Learn More
                </button>
              </div>
            </div>

            <div className="flex min-h-72 items-center justify-center bg-[#F4F7FB] p-8">
              <div className="grid w-full max-w-sm grid-cols-2 gap-4">
                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <Package size={24} className="text-[#001F3F]" />
                  <p className="mt-4 text-2xl font-bold text-[#001F3F]">
                    List
                  </p>
                  <p className="text-sm text-gray-500">
                    Add your equipment
                  </p>
                </div>

                <div className="rounded-xl bg-white p-5 shadow-sm">
                  <CalendarDays size={24} className="text-[#001F3F]" />
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