"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  DollarSign,
  Loader2,
  MapPin,
  Package,
  Plus,
  ShieldCheck,
  Tag,
  ToolCase,
  X,
} from "lucide-react";
import Link from "next/link";

import { auth } from "@/lib/firebase";

const categories = [
  "Hand Tools",
  "Power Tools",
  "Lifting",
  "Diagnostics",
  "Electrical",
  "Engine Tools",
  "Brake Tools",
  "Other",
];

export default function ToolListingPage() {
  const [toolName, setToolName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [specifications, setSpecifications] = useState("");

  const [dailyRate, setDailyRate] = useState("");
  const [deposit, setDeposit] = useState("");

  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("Good");
  const [available, setAvailable] = useState(true);

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  // ======================================================
  // PUBLISH LISTING
  // ======================================================

  const handlePhotoUpload = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const file = event.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setErrorMsg("Please select an image file.");
    return;
  }

  if (photoUrls.length >= 3) {
    setErrorMsg(
      "You can upload a maximum of 3 photos."
    );
    return;
  }

  const cloudName =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  const uploadPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    setErrorMsg(
      "Cloudinary configuration is missing."
    );
    return;
  }

  try {
    setUploadingPhoto(true);
    setErrorMsg("");

    const formData = new FormData();

    formData.append("file", file);
    formData.append(
      "upload_preset",
      uploadPreset
    );

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(
        "Photo upload failed."
      );
    }

    const data = await response.json();

    setPhotoUrls((current) => [
      ...current,
      data.secure_url,
    ]);
  } catch (error) {
    console.error(
      "Photo upload failed:",
      error
    );

    setErrorMsg(
      "Could not upload the photo."
    );
  } finally {
    setUploadingPhoto(false);

    event.target.value = "";
  }
};

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setSubmitted(false);
    setErrorMsg("");
    setLoading(true);

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setErrorMsg(
        "You must be signed in to publish a tool listing."
      );

      setLoading(false);
      return;
    }

    const price = Number(dailyRate);
    const depositAmount = Number(deposit || 0);

    if (
      !toolName.trim() ||
      !category.trim() ||
      !description.trim() ||
      !location.trim()
    ) {
      setErrorMsg(
        "Please complete all required fields."
      );

      setLoading(false);
      return;
    }

    if (!price || price <= 0) {
      setErrorMsg(
        "Please enter a valid daily rental rate."
      );

      setLoading(false);
      return;
    }

    try {
      const sellerName =
        currentUser.displayName ||
        currentUser.email?.split("@")[0] ||
        "MotorMate User";

      const response = await fetch(
        `${apiUrl}/api/diy/listings`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            owner_id: currentUser.uid,

            seller_name: sellerName,

            item_name: toolName.trim(),

            category,

            condition,

            price,

            deposit: depositAmount,

            location: location.trim(),

            availability: available
              ? "available"
              : "unavailable",

            description: description.trim(),

            specifications:
              specifications.trim() || null,

            photo_urls: photoUrls,

            distance: 0,

            rating: 0,

            reviews: 0,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));

        setErrorMsg(
          errorData.detail ||
            `Failed to publish listing (${response.status})`
        );

        return;
      }

      const result = await response.json();

      console.log(
        "Listing successfully created:",
        result
      );

      setSubmitted(true);
    } catch (error) {
      console.error(
        "Failed to publish listing:",
        error
      );

      setErrorMsg(
        "Could not connect to the MotorMate backend."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* HEADER */}

      <section className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            href="/tooldrop"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-[#001F3F]"
          >
            <ArrowLeft size={17} />
            Back to ToolDrop
          </Link>

          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Tool Owner
          </p>

          <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">
            List a Tool
          </h1>

          <p className="mt-2 max-w-2xl text-gray-500">
            Create a rental listing for automotive
            tools you own and make them available
            to other MotorMate users.
          </p>
        </div>

        <div className="rounded-xl border bg-white px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-[#001F3F]">
              <ShieldCheck size={20} />
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-900">
                Owner Protection
              </p>

              <p className="text-xs text-gray-500">
                Add accurate details before
                publishing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SUCCESS MESSAGE */}

      {submitted && (
        <section className="mt-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle2
            className="mt-0.5 shrink-0"
            size={20}
          />

          <div>
            <p className="font-semibold">
              Listing published successfully.
            </p>

            <p className="mt-1 text-sm">
              Your tool has been saved to MotorMate
              and is now available through ToolDrop.
            </p>
          </div>
        </section>
      )}

      {/* ERROR MESSAGE */}

      {errorMsg && (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </section>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1fr_360px]"
      >
        {/* LEFT SIDE */}

        <div className="space-y-6">
          {/* BASIC INFORMATION */}

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b pb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
                <ToolCase size={20} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Tool Information
                </h2>

                <p className="text-sm text-gray-500">
                  Tell renters what you are listing.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {/* TOOL NAME */}

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Tool Name
                </label>

                <input
                  type="text"
                  value={toolName}
                  onChange={(e) =>
                    setToolName(e.target.value)
                  }
                  placeholder="e.g. Milwaukee Cordless Impact Wrench"
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                  required
                />
              </div>

              {/* CATEGORY */}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#001F3F]"
                  required
                >
                  <option value="">
                    Select a category
                  </option>

                  {categories.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              {/* CONDITION */}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Condition
                </label>

                <select
                  value={condition}
                  onChange={(e) =>
                    setCondition(e.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-[#001F3F]"
                >
                  <option>Like New</option>
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                </select>
              </div>

              {/* DESCRIPTION */}

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  rows={5}
                  maxLength={500}
                  placeholder="Describe the tool, what it includes, and any important usage notes..."
                  className="mt-2 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                  required
                />

                <div className="mt-2 flex justify-between text-xs text-gray-400">
                  <span>
                    Include accessories and
                    important details.
                  </span>

                  <span>
                    {description.length}/500
                  </span>
                </div>
              </div>

              {/* SPECIFICATIONS */}

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Specifications
                </label>

                <textarea
                  value={specifications}
                  onChange={(e) =>
                    setSpecifications(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="e.g. 1/2-inch drive, 18V battery, 1,200 ft-lb max torque"
                  className="mt-2 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
                />

                <p className="mt-2 text-xs text-gray-400">
                  Add technical information that
                  renters may need before renting.
                </p>
              </div>
            </div>
          </section>

          {/* PHOTOS */}

<section className="rounded-2xl border bg-white p-6 shadow-sm">
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
      <Camera size={20} />
    </div>

    <div>
      <h2 className="text-xl font-bold text-[#001F3F]">
        Tool Photos
      </h2>

      <p className="text-sm text-gray-500">
        Add up to 3 photos showing the
        current condition of your tool.
      </p>
    </div>
  </div>

  <div className="mt-6 grid gap-4 md:grid-cols-3">
    {[0, 1, 2].map((index) => {
      const photo = photoUrls[index];

      if (photo) {
        return (
          <div
            key={index}
            className="relative min-h-40 overflow-hidden rounded-xl border bg-gray-100"
          >
            <img
              src={photo}
              alt={`Tool photo ${index + 1}`}
              className="h-40 w-full object-cover"
            />

            <button
              type="button"
              onClick={() =>
                setPhotoUrls((current) =>
                  current.filter(
                    (_, photoIndex) =>
                      photoIndex !== index
                  )
                )
              }
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
            >
              <X size={16} />
            </button>
          </div>
        );
      }

      return (
        <label
          key={index}
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 transition hover:border-[#001F3F] hover:bg-blue-50"
        >
          {uploadingPhoto ? (
            <Loader2
              size={26}
              className="animate-spin"
            />
          ) : index === 0 ? (
            <Plus size={26} />
          ) : (
            <Camera size={24} />
          )}

          <span className="mt-2 text-sm font-semibold">
            {index === 0
              ? "Add Main Photo"
              : "Add Photo"}
          </span>

          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
            disabled={uploadingPhoto}
          />
        </label>
      );
    })}
  </div>

  <p className="mt-4 text-xs text-gray-400">
    JPG, PNG, WEBP and other standard image
    formats are supported.
  </p>
</section>

          {/* PRICING */}

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b pb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
                <DollarSign size={20} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Pricing
                </h2>

                <p className="text-sm text-gray-500">
                  Set your rental price and
                  refundable deposit.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {/* DAILY RATE */}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Daily Rental Rate
                </label>

                <div className="relative mt-2">
                  <DollarSign
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={dailyRate}
                    onChange={(e) =>
                      setDailyRate(
                        e.target.value
                      )
                    }
                    placeholder="20"
                    className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 outline-none focus:border-[#001F3F]"
                    required
                  />
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  Amount charged per day.
                </p>
              </div>

              {/* DEPOSIT */}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Security Deposit
                </label>

                <div className="relative mt-2">
                  <DollarSign
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deposit}
                    onChange={(e) =>
                      setDeposit(e.target.value)
                    }
                    placeholder="50"
                    className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 outline-none focus:border-[#001F3F]"
                  />
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  Refundable when the tool is
                  returned properly.
                </p>
              </div>
            </div>
          </section>

          {/* LOCATION */}

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
                <MapPin size={20} />
              </div>

              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Pickup Location
                </h2>

                <p className="text-sm text-gray-500">
                  Choose the general location where
                  renters can pick up the tool.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-sm font-semibold text-gray-700">
                City or ZIP Code
              </label>

              <div className="relative mt-2">
                <MapPin
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={location}
                  onChange={(e) =>
                    setLocation(e.target.value)
                  }
                  placeholder="e.g. Farmingdale, NY"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F]"
                  required
                />
              </div>

              <p className="mt-2 text-xs text-gray-400">
                Your exact address should not be
                shown publicly.
              </p>
            </div>
          </section>
        </div>

        {/* RIGHT SIDE */}

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-white p-5 shadow-sm xl:sticky xl:top-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Listing Preview
            </p>

            <div className="mt-4 flex h-44 items-center justify-center rounded-xl bg-gradient-to-br from-gray-50 to-gray-100">
              <ToolCase
                size={55}
                className="text-gray-300"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {toolName ||
                      "Your Tool Name"}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    {category ||
                      "Tool Category"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-[#001F3F]">
                    ${dailyRate || "0"}
                  </p>

                  <p className="text-xs text-gray-400">
                    per day
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t pt-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <Tag size={16} />
                  {condition} condition
                </div>

                <div className="flex items-center gap-2">
                  <MapPin size={16} />

                  {location ||
                    "Pickup location"}
                </div>

                <div className="flex items-center gap-2">
                  <Package size={16} />

                  {available
                    ? "Available for rent"
                    : "Currently unavailable"}
                </div>
              </div>
            </div>

            {/* AVAILABILITY */}

            <div className="mt-6 rounded-xl bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    Listing Availability
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Show this tool as available to
                    renters.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setAvailable(!available)
                  }
                  className={`relative h-7 w-12 rounded-full transition ${
                    available
                      ? "bg-[#001F3F]"
                      : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                      available
                        ? "left-6"
                        : "left-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* PUBLISH */}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] py-3.5 font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />

                  Publishing...
                </>
              ) : (
                "Publish Listing"
              )}
            </button>

            <p className="mt-3 text-center text-xs text-gray-400">
              You can edit or disable the listing
              later.
            </p>
          </section>
        </aside>
      </form>
    </div>
  );
}