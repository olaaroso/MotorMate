"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  UserRound,
  X,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";

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

type UserProfile = {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
};

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

  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  // ======================================================
  // LOAD USER PROFILE
  // ======================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setProfile(null);
          setProfileLoading(false);
          return;
        }

        try {
          setProfileLoading(true);

          const userRef = doc(
            db,
            "users",
            user.uid
          );

          const snapshot =
            await getDoc(userRef);

          if (!snapshot.exists()) {
            setProfile({
              firstName: "",
              lastName: "",
              city: "",
              state: "",
              zipCode: "",
              phone: "",
            });

            return;
          }

          const data = snapshot.data();

          const loadedProfile: UserProfile = {
            firstName:
              data.firstName || "",
            lastName:
              data.lastName || "",
            city:
              data.city || "",
            state:
              data.state || "",
            zipCode:
              data.zipCode || "",
            phone:
              data.phone || "",
          };

          setProfile(loadedProfile);

          // Automatically use the user's saved
          // general location for new listings.
          if (
            loadedProfile.city &&
            loadedProfile.state
          ) {
            setLocation(
              `${loadedProfile.city}, ${loadedProfile.state}`
            );
          }
        } catch (error) {
          console.error(
            "Failed to load user profile:",
            error
          );

          setErrorMsg(
            "Unable to load your account information."
          );
        } finally {
          setProfileLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // ======================================================
  // PROFILE COMPLETENESS
  // ======================================================

  const profileComplete =
    !!profile?.firstName.trim() &&
    !!profile?.lastName.trim() &&
    !!profile?.city.trim() &&
    !!profile?.state.trim() &&
    !!profile?.zipCode.trim();

  const sellerName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : "";

  // ======================================================
  // PHOTO UPLOAD
  // ======================================================

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg(
        "Please select an image file."
      );
      return;
    }

    if (photoUrls.length >= 3) {
      setErrorMsg(
        "You can upload a maximum of 3 photos."
      );
      return;
    }

    const cloudName =
      process.env
        .NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const uploadPreset =
      process.env
        .NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      setErrorMsg(
        "Cloudinary configuration is missing."
      );
      return;
    }

    try {
      setUploadingPhoto(true);
      setErrorMsg("");

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

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

      const data =
        await response.json();

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

  // ======================================================
  // PUBLISH LISTING
  // ======================================================

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (submitted) return;

    setErrorMsg("");

    const currentUser =
      auth.currentUser;

    if (!currentUser) {
      setErrorMsg(
        "You must be signed in to publish a tool listing."
      );
      return;
    }

    if (!profileComplete) {
      setErrorMsg(
        "Complete your account information before listing a tool."
      );
      return;
    }

    if (
      !toolName.trim() ||
      !category.trim() ||
      !description.trim() ||
      !location.trim()
    ) {
      setErrorMsg(
        "Please complete all required fields."
      );
      return;
    }

    const price =
      Number(dailyRate);

    const depositAmount =
      Number(deposit || 0);

    if (!price || price <= 0) {
      setErrorMsg(
        "Please enter a valid daily rental rate."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${apiUrl}/api/diy/listings`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            owner_id:
              currentUser.uid,

            seller_name:
              sellerName,

            item_name:
              toolName.trim(),

            category,

            condition,

            price,

            deposit:
              depositAmount,

            location:
              location.trim(),

            zip_code:
              profile?.zipCode || "",

            availability:
              available
                ? "available"
                : "unavailable",

            description:
              description.trim(),

            specifications:
              specifications.trim() ||
              null,

            photo_urls:
              photoUrls,

            distance: 0,

            rating: 0,

            reviews: 0,
          }),
        }
      );

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          errorData.detail ||
            `Failed to publish listing (${response.status})`
        );
      }

      const result =
        await response.json();

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
        error instanceof Error
          ? error.message
          : "Could not connect to the MotorMate backend."
      );
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // PROFILE LOADING
  // ======================================================

  if (profileLoading) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center p-16 text-gray-500">
        <Loader2
          size={22}
          className="mr-3 animate-spin"
        />

        Loading account information...
      </div>
    );
  }

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

      {/* INCOMPLETE PROFILE */}

      {!profileComplete && (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
              <UserRound size={20} />
            </div>

            <div className="flex-1">
              <h2 className="font-bold text-amber-900">
                Complete your profile before listing a tool
              </h2>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                MotorMate needs your first name,
                last name, city, state, and ZIP code
                before you can publish ToolDrop
                listings.
              </p>

              <Link
                href="/account"
                className="mt-4 inline-flex rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]"
              >
                Complete Account Information
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* PROFILE READY */}

      {profileComplete && (
        <section className="mt-6 flex items-center justify-between rounded-xl border bg-white px-5 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Listing As
            </p>

            <p className="mt-1 font-semibold text-[#001F3F]">
              {sellerName}
            </p>
          </div>

          <Link
            href="/account"
            className="text-sm font-semibold text-blue-600 hover:underline"
          >
            Edit Profile
          </Link>
        </section>
      )}

      {/* SUCCESS */}

      {submitted && (
        <section className="mt-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle2
            size={20}
            className="mt-0.5 shrink-0"
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

      {/* ERROR */}

      {errorMsg && (
        <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </section>
      )}

      <form
        onSubmit={handleSubmit}
        className={`mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1fr_360px] ${
          !profileComplete
            ? "pointer-events-none opacity-50"
            : ""
        }`}
      >
        <div className="space-y-6">
          {/* TOOL INFO */}

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
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Tool Name
                </label>

                <input
                  type="text"
                  value={toolName}
                  onChange={(e) =>
                    setToolName(
                      e.target.value
                    )
                  }
                  placeholder="e.g. Milwaukee Cordless Impact Wrench"
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#001F3F]"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Category
                </label>

                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                  required
                >
                  <option value="">
                    Select a category
                  </option>

                  {categories.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Condition
                </label>

                <select
                  value={condition}
                  onChange={(e) =>
                    setCondition(
                      e.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3"
                >
                  <option>Like New</option>
                  <option>Excellent</option>
                  <option>Good</option>
                  <option>Fair</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(e) =>
                    setDescription(
                      e.target.value
                    )
                  }
                  rows={5}
                  maxLength={500}
                  placeholder="Describe the tool, what it includes, and any important usage notes..."
                  className="mt-2 w-full resize-none rounded-xl border border-gray-300 px-4 py-3"
                  required
                />

                <p className="mt-2 text-right text-xs text-gray-400">
                  {description.length}/500
                </p>
              </div>

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
                  className="mt-2 w-full resize-none rounded-xl border border-gray-300 px-4 py-3"
                />
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
              {[0, 1, 2].map(
                (index) => {
                  const photo =
                    photoUrls[index];

                  if (photo) {
                    return (
                      <div
                        key={index}
                        className="relative min-h-40 overflow-hidden rounded-xl border bg-gray-100"
                      >
                        <img
                          src={photo}
                          alt={`Tool photo ${
                            index + 1
                          }`}
                          className="h-40 w-full object-cover"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setPhotoUrls(
                              (
                                current
                              ) =>
                                current.filter(
                                  (
                                    _,
                                    photoIndex
                                  ) =>
                                    photoIndex !==
                                    index
                                )
                            )
                          }
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <label
                      key={index}
                      className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:border-[#001F3F]"
                    >
                      {uploadingPhoto ? (
                        <Loader2
                          size={26}
                          className="animate-spin"
                        />
                      ) : index ===
                        0 ? (
                        <Plus
                          size={26}
                        />
                      ) : (
                        <Camera
                          size={24}
                        />
                      )}

                      <span className="mt-2 text-sm font-semibold">
                        {index === 0
                          ? "Add Main Photo"
                          : "Add Photo"}
                      </span>

                      <input
                        type="file"
                        accept="image/*"
                        onChange={
                          handlePhotoUpload
                        }
                        className="hidden"
                        disabled={
                          uploadingPhoto
                        }
                      />
                    </label>
                  );
                }
              )}
            </div>
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
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Daily Rental Rate
                </label>

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
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Security Deposit
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deposit}
                  onChange={(e) =>
                    setDeposit(
                      e.target.value
                    )
                  }
                  placeholder="50"
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                />
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
                  Use a general pickup location.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-sm font-semibold text-gray-700">
                City or ZIP Code
              </label>

              <input
                type="text"
                value={location}
                onChange={(e) =>
                  setLocation(
                    e.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3"
                required
              />

              <p className="mt-2 text-xs text-gray-400">
                Your exact home address should not
                be displayed publicly.
              </p>
            </div>
          </section>
        </div>

        {/* RIGHT PREVIEW */}

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-white p-5 shadow-sm xl:sticky xl:top-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Listing Preview
            </p>

            <div className="mt-4 flex h-44 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {photoUrls[0] ? (
                <img
                  src={photoUrls[0]}
                  alt="Tool preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ToolCase
                  size={55}
                  className="text-gray-300"
                />
              )}
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
                    $
                    {dailyRate ||
                      "0"}
                  </p>

                  <p className="text-xs text-gray-400">
                    per day
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 border-t pt-4 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <UserRound size={16} />
                  Listed by{" "}
                  {sellerName ||
                    "MotorMate User"}
                </div>

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
                    setAvailable(
                      !available
                    )
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

            <button
              type="submit"
              disabled={
                loading ||
                submitted ||
                uploadingPhoto ||
                !profileComplete
              }
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
              ) : submitted ? (
                "Published"
              ) : !profileComplete ? (
                "Complete Profile First"
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