"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Loader2,
  MapPin,
  Package,
  ShieldCheck,
  Tag,
  ToolCase,
  UserRound,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";

type ToolListing = {
  id: string;

  owner_id: string;
  seller_name: string;

  item_name: string;
  category: string;
  condition: string;

  price: number;
  deposit: number;

  location: string;
  zip_code?: string;

  availability: string;

  description?: string;
  specifications?: string;

  photo_urls?: string[];
};

type RenterProfile = {
  firstName: string;
  lastName: string;
};

function getTodayString() {
  const now = new Date();

  const timezoneOffset =
    now.getTimezoneOffset() * 60 * 1000;

  return new Date(
    now.getTime() - timezoneOffset
  )
    .toISOString()
    .split("T")[0];
}

function calculateRentalDays(
  startDate: string,
  endDate: string
) {
  if (!startDate || !endDate) {
    return 0;
  }

  const startParts = startDate
    .split("-")
    .map(Number);

  const endParts = endDate
    .split("-")
    .map(Number);

  const start = new Date(
    startParts[0],
    startParts[1] - 1,
    startParts[2]
  );

  const end = new Date(
    endParts[0],
    endParts[1] - 1,
    endParts[2]
  );

  if (end < start) {
    return 0;
  }

  const difference =
    end.getTime() - start.getTime();

  return (
    Math.floor(
      difference /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
}

export default function ToolDetailsPage() {
  const params = useParams();

  const listingId =
    params.id as string;

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  const [tool, setTool] =
    useState<ToolListing | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    selectedPhoto,
    setSelectedPhoto,
  ] = useState(0);

  // ======================================================
  // SIGNED-IN USER
  // ======================================================

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [
    renterProfile,
    setRenterProfile,
  ] = useState<RenterProfile | null>(
    null
  );

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  // ======================================================
  // RENTAL REQUEST
  // ======================================================

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [
    requestLoading,
    setRequestLoading,
  ] = useState(false);

  const [
    requestError,
    setRequestError,
  ] = useState("");

  const [
    requestSuccess,
    setRequestSuccess,
  ] = useState(false);

  const today = getTodayString();

  // ======================================================
  // LOAD TOOL
  // ======================================================

  useEffect(() => {
    const loadTool = async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${apiUrl}/api/diy/listings/${listingId}`
          );

        if (!response.ok) {
          const data =
            await response
              .json()
              .catch(() => ({}));

          throw new Error(
            data.detail ||
              "Unable to load this tool."
          );
        }

        const data =
          await response.json();

        setTool(
          data.listing
        );
      } catch (error) {
        console.error(
          "Failed to load tool:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load this tool."
        );
      } finally {
        setLoading(false);
      }
    };

    if (listingId) {
      loadTool();
    }
  }, [
    apiUrl,
    listingId,
  ]);

  // ======================================================
  // LOAD RENTer's PROFILE
  // ======================================================

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            setCurrentUserId("");
            setRenterProfile(null);
            setAuthLoading(false);

            return;
          }

          try {
            setAuthLoading(true);

            setCurrentUserId(
              user.uid
            );

            const userRef =
              doc(
                db,
                "users",
                user.uid
              );

            const snapshot =
              await getDoc(
                userRef
              );

            if (
              snapshot.exists()
            ) {
              const data =
                snapshot.data();

              setRenterProfile({
                firstName:
                  data.firstName ||
                  "",
                lastName:
                  data.lastName ||
                  "",
              });
            } else {
              setRenterProfile({
                firstName: "",
                lastName: "",
              });
            }
          } catch (error) {
            console.error(
              "Failed to load renter profile:",
              error
            );

            setRenterProfile({
              firstName: "",
              lastName: "",
            });
          } finally {
            setAuthLoading(
              false
            );
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  // ======================================================
  // RENTAL CALCULATIONS
  // ======================================================

  const rentalDays =
    useMemo(
      () =>
        calculateRentalDays(
          startDate,
          endDate
        ),
      [
        startDate,
        endDate,
      ]
    );

  const rentalPrice =
    useMemo(() => {
      if (!tool) return 0;

      return (
        rentalDays *
        Number(tool.price)
      );
    }, [
      rentalDays,
      tool,
    ]);

  const totalWithDeposit =
    useMemo(() => {
      if (!tool) return 0;

      return (
        rentalPrice +
        Number(
          tool.deposit || 0
        )
      );
    }, [
      rentalPrice,
      tool,
    ]);

  const isOwnTool =
    !!tool &&
    !!currentUserId &&
    tool.owner_id ===
      currentUserId;

  const renterName =
    renterProfile
      ? `${renterProfile.firstName} ${renterProfile.lastName}`.trim()
      : "";

  const renterProfileComplete =
    !!renterProfile?.firstName.trim() &&
    !!renterProfile?.lastName.trim();

  // ======================================================
  // SUBMIT RENTAL REQUEST
  // ======================================================

  const handleRentalRequest =
    async () => {
      setRequestError("");

      if (!tool) {
        return;
      }

      const user =
        auth.currentUser;

      if (!user) {
        setRequestError(
          "You must be signed in to request a rental."
        );

        return;
      }

      if (isOwnTool) {
        setRequestError(
          "You cannot request to rent your own tool."
        );

        return;
      }

      if (
        !renterProfileComplete
      ) {
        setRequestError(
          "Complete your first and last name in Account Settings before requesting a rental."
        );

        return;
      }

      if (
        !startDate ||
        !endDate
      ) {
        setRequestError(
          "Select a start date and end date."
        );

        return;
      }

      if (
        startDate < today
      ) {
        setRequestError(
          "The rental start date cannot be in the past."
        );

        return;
      }

      if (
        endDate <
        startDate
      ) {
        setRequestError(
          "The rental end date cannot be before the start date."
        );

        return;
      }

      try {
        setRequestLoading(
          true
        );

        const response =
          await fetch(
            `${apiUrl}/api/diy/rental-requests`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  listing_id:
                    tool.id,

                  renter_id:
                    user.uid,

                  renter_name:
                    renterName,

                  start_date:
                    startDate,

                  end_date:
                    endDate,
                }),
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to submit rental request."
          );
        }

        console.log(
          "Rental request created:",
          data
        );

        setRequestSuccess(
          true
        );
      } catch (error) {
        console.error(
          "Rental request failed:",
          error
        );

        setRequestError(
          error instanceof Error
            ? error.message
            : "Unable to submit rental request."
        );
      } finally {
        setRequestLoading(
          false
        );
      }
    };

  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[500px] max-w-7xl items-center justify-center p-8">
        <Loader2
          size={28}
          className="animate-spin text-gray-400"
        />

        <span className="ml-3 text-gray-500">
          Loading tool...
        </span>
      </div>
    );
  }

  // ======================================================
  // TOOL NOT AVAILABLE
  // ======================================================

  if (
    error ||
    !tool
  ) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <Link
          href="/tooldrop"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#001F3F]"
        >
          <ArrowLeft
            size={17}
          />
          Back to ToolDrop
        </Link>

        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h1 className="text-xl font-bold text-red-800">
            Tool unavailable
          </h1>

          <p className="mt-2 text-sm text-red-700">
            {error ||
              "This listing could not be found."}
          </p>
        </div>
      </div>
    );
  }

  const photos =
    tool.photo_urls || [];

  const activePhoto =
    photos[
      selectedPhoto
    ];

  // ======================================================
  // PAGE
  // ======================================================

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* BACK */}

      <Link
        href="/tooldrop"
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[#001F3F]"
      >
        <ArrowLeft
          size={17}
        />
        Back to ToolDrop
      </Link>

      {/* MAIN GRID */}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_0.8fr]">
        {/* LEFT */}

        <div className="space-y-6">
          {/* IMAGE GALLERY */}

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex h-[420px] items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {activePhoto ? (
                <img
                  src={
                    activePhoto
                  }
                  alt={
                    tool.item_name
                  }
                  className="h-full w-full object-cover"
                />
              ) : (
                <ToolCase
                  size={80}
                  className="text-gray-300"
                />
              )}
            </div>

            {photos.length >
              1 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {photos.map(
                  (
                    photo,
                    index
                  ) => (
                    <button
                      key={
                        photo
                      }
                      type="button"
                      onClick={() =>
                        setSelectedPhoto(
                          index
                        )
                      }
                      className={`overflow-hidden rounded-xl border-2 ${
                        selectedPhoto ===
                        index
                          ? "border-[#001F3F]"
                          : "border-transparent"
                      }`}
                    >
                      <img
                        src={
                          photo
                        }
                        alt={`${tool.item_name} photo ${
                          index +
                          1
                        }`}
                        className="h-24 w-full object-cover"
                      />
                    </button>
                  )
                )}
              </div>
            )}
          </section>

          {/* TOOL INFO */}

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#001F3F]">
                  {
                    tool.category
                  }
                </span>

                <h1 className="mt-3 text-3xl font-bold text-[#001F3F]">
                  {
                    tool.item_name
                  }
                </h1>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-2">
                    <Tag
                      size={
                        16
                      }
                    />
                    {
                      tool.condition
                    }{" "}
                    condition
                  </span>

                  <span className="flex items-center gap-2">
                    <MapPin
                      size={
                        16
                      }
                    />
                    {
                      tool.location
                    }
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 px-5 py-4 text-right">
                <p className="text-3xl font-bold text-[#001F3F]">
                  $
                  {
                    tool.price
                  }
                </p>

                <p className="text-sm text-gray-500">
                  per day
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-bold text-[#001F3F]">
                Description
              </h2>

              <p className="mt-3 whitespace-pre-line leading-7 text-gray-600">
                {tool.description ||
                  "No description provided."}
              </p>
            </div>

            <div className="mt-7">
              <h2 className="text-lg font-bold text-[#001F3F]">
                Specifications
              </h2>

              <p className="mt-3 whitespace-pre-line leading-7 text-gray-600">
                {tool.specifications ||
                  "No specifications provided."}
              </p>
            </div>
          </section>

          {/* OWNER */}

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#001F3F] text-white">
                <UserRound
                  size={22}
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Listed By
                </p>

                <p className="mt-1 font-bold text-[#001F3F]">
                  {
                    tool.seller_name
                  }
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT */}

        <aside>
          <section className="sticky top-8 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#001F3F]">
              Rent This Tool
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Choose your rental dates
              and send the owner a
              request.
            </p>

            {/* OWN TOOL MESSAGE */}

            {!authLoading &&
              isOwnTool && (
                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="font-semibold text-[#001F3F]">
                    This is your tool
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    You can view your
                    listing, but you
                    cannot request to
                    rent your own tool.
                  </p>

                  <Link
                    href="/myTools"
                    className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
                  >
                    Manage My Tools
                  </Link>
                </div>
              )}

            {/* SUCCESS */}

            {requestSuccess && (
              <div className="mt-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0"
                />

                <div>
                  <p className="font-semibold">
                    Rental request sent.
                  </p>

                  <p className="mt-1 text-sm">
                    The tool owner can
                    now review your
                    request.
                  </p>
                </div>
              </div>
            )}

            {/* ERROR */}

            {requestError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {
                  requestError
                }

                {!renterProfileComplete &&
                  !isOwnTool && (
                    <div className="mt-3">
                      <Link
                        href="/account"
                        className="font-semibold underline"
                      >
                        Open Account
                        Settings
                      </Link>
                    </div>
                  )}
              </div>
            )}

            {/* DATES */}

            {!isOwnTool && (
              <div className="mt-6 grid gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Start Date
                  </label>

                  <div className="relative mt-2">
                    <CalendarDays
                      size={
                        17
                      }
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="date"
                      min={
                        today
                      }
                      value={
                        startDate
                      }
                      onChange={(
                        event
                      ) => {
                        const value =
                          event
                            .target
                            .value;

                        setStartDate(
                          value
                        );

                        if (
                          endDate &&
                          endDate <
                            value
                        ) {
                          setEndDate(
                            ""
                          );
                        }

                        setRequestError(
                          ""
                        );
                      }}
                      disabled={
                        requestSuccess
                      }
                      className="w-full rounded-xl border border-gray-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    End Date
                  </label>

                  <div className="relative mt-2">
                    <CalendarDays
                      size={
                        17
                      }
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="date"
                      min={
                        startDate ||
                        today
                      }
                      value={
                        endDate
                      }
                      onChange={(
                        event
                      ) => {
                        setEndDate(
                          event
                            .target
                            .value
                        );

                        setRequestError(
                          ""
                        );
                      }}
                      disabled={
                        requestSuccess
                      }
                      className="w-full rounded-xl border border-gray-300 py-3 pl-11 pr-4 outline-none focus:border-[#001F3F]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PRICING */}

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <DollarSign
                    size={18}
                    className="text-[#001F3F]"
                  />

                  <span className="text-sm text-gray-600">
                    Daily Rate
                  </span>
                </div>

                <span className="font-bold text-gray-900">
                  $
                  {
                    tool.price
                  }
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <ShieldCheck
                    size={18}
                    className="text-[#001F3F]"
                  />

                  <span className="text-sm text-gray-600">
                    Security Deposit
                  </span>
                </div>

                <span className="font-bold text-gray-900">
                  $
                  {tool.deposit ||
                    0}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <Package
                    size={18}
                    className="text-[#001F3F]"
                  />

                  <span className="text-sm text-gray-600">
                    Availability
                  </span>
                </div>

                <span className="font-semibold capitalize text-green-700">
                  {
                    tool.availability
                  }
                </span>
              </div>
            </div>

            {/* PRICE BREAKDOWN */}

            {!isOwnTool &&
              rentalDays > 0 && (
                <div className="mt-6 rounded-xl border border-gray-200 p-4">
                  <h3 className="font-bold text-[#001F3F]">
                    Rental Summary
                  </h3>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>
                        $
                        {
                          tool.price
                        }{" "}
                        ×{" "}
                        {
                          rentalDays
                        }{" "}
                        {rentalDays ===
                        1
                          ? "day"
                          : "days"}
                      </span>

                      <span>
                        $
                        {rentalPrice.toFixed(
                          2
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-gray-600">
                      <span>
                        Security Deposit
                      </span>

                      <span>
                        $
                        {Number(
                          tool.deposit ||
                            0
                        ).toFixed(
                          2
                        )}
                      </span>
                    </div>

                    <div className="border-t pt-3">
                      <div className="flex justify-between">
                        <span className="font-bold text-gray-900">
                          Total
                        </span>

                        <span className="text-lg font-bold text-[#001F3F]">
                          $
                          {totalWithDeposit.toFixed(
                            2
                          )}
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-gray-400">
                        The security
                        deposit is
                        refundable when
                        the tool is
                        returned
                        properly.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* REQUEST BUTTON */}

            {!isOwnTool && (
              <button
                type="button"
                onClick={
                  handleRentalRequest
                }
                disabled={
                  authLoading ||
                  requestLoading ||
                  requestSuccess ||
                  !startDate ||
                  !endDate
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] py-3.5 font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {requestLoading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />

                    Sending Request...
                  </>
                ) : requestSuccess ? (
                  <>
                    <CheckCircle2
                      size={18}
                    />

                    Request Sent
                  </>
                ) : (
                  "Request Rental"
                )}
              </button>
            )}

            {!isOwnTool &&
              !requestSuccess && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  The owner must approve
                  your request before
                  the rental is
                  confirmed.
                </p>
              )}
          </section>
        </aside>
      </div>
    </div>
  );
}