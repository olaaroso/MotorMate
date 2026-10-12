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
  ChevronLeft,
  ChevronRight,
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

type ReservedRange = {
  request_id: string;
  start_date: string;
  end_date: string;
};

type RenterProfile = {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  zipCode: string;
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

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(iso: string) {
  if (!iso) return "";

  const [year, month, day] =
    iso.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calculateRentalDays(
  startDate: string,
  endDate: string
) {
  if (!startDate || !endDate) {
    return 0;
  }

  const [sy, sm, sd] =
    startDate.split("-").map(Number);

  const [ey, em, ed] =
    endDate.split("-").map(Number);

  const start = new Date(
    sy,
    sm - 1,
    sd
  );

  const end = new Date(
    ey,
    em - 1,
    ed
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

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
) {
  return (
    startA <= endB &&
    endA >= startB
  );
}

function getCalendarDays(
  monthDate: Date
) {
  const year =
    monthDate.getFullYear();

  const month =
    monthDate.getMonth();

  const firstDay =
    new Date(year, month, 1);

  const start = new Date(
    year,
    month,
    1 - firstDay.getDay()
  );

  return Array.from(
    { length: 42 },
    (_, index) => {
      const date =
        new Date(start);

      date.setDate(
        start.getDate() + index
      );

      return date;
    }
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
    useState<ToolListing | null>(null);

  const [
    reservedRanges,
    setReservedRanges,
  ] = useState<ReservedRange[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    selectedPhoto,
    setSelectedPhoto,
  ] = useState(0);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState("");

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

  const today =
    getTodayString();

  const currentMonth =
    useMemo(() => {
      const [year, month] =
        today.split("-").map(Number);

      return new Date(
        year,
        month - 1,
        1
      );
    }, [today]);

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(currentMonth);

  const loadTool =
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await fetch(
            `${apiUrl}/api/diy/listings/${listingId}`
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail ||
              "Unable to load this tool."
          );
        }

        setTool(
          data.listing
        );

        setReservedRanges(
          data.reserved_ranges || []
        );
      } catch (loadError) {
        console.error(
          "Failed to load tool:",
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this tool."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (listingId) {
      loadTool();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiUrl,
    listingId,
  ]);

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
                city:
                  data.city ||
                  "",
                state:
                  data.state ||
                  "",
                zipCode:
                  data.zipCode ||
                  "",
              });
            } else {
              setRenterProfile({
                firstName: "",
                lastName: "",
                city: "",
                state: "",
                zipCode: "",
              });
            }
          } catch (profileError) {
            console.error(
              "Failed to load renter profile:",
              profileError
            );

            setRenterProfile({
              firstName: "",
              lastName: "",
              city: "",
              state: "",
              zipCode: "",
            });
          } finally {
            setAuthLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, []);

  const isDateReserved = (
    iso: string
  ) =>
    reservedRanges.some(
      (range) =>
        iso >= range.start_date &&
        iso <= range.end_date
    );

  const rangeHitsReservation = (
    start: string,
    end: string
  ) =>
    reservedRanges.some(
      (range) =>
        rangesOverlap(
          start,
          end,
          range.start_date,
          range.end_date
        )
    );

  const handleCalendarDateClick = (
    iso: string
  ) => {
    setRequestError("");
    setRequestSuccess(false);

    if (
      iso < today ||
      isDateReserved(iso)
    ) {
      return;
    }

    if (
      !startDate ||
      endDate
    ) {
      setStartDate(iso);
      setEndDate("");
      return;
    }

    if (iso < startDate) {
      setStartDate(iso);
      setEndDate("");
      return;
    }

    if (
      rangeHitsReservation(
        startDate,
        iso
      )
    ) {
      setRequestError(
        "That date range crosses reserved dates. Choose an end date before the blocked dates, or clear the dates and choose a later start."
      );
      return;
    }

    setEndDate(iso);
  };

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
    !!renterProfile?.lastName.trim() &&
    !!renterProfile?.city.trim() &&
    !!renterProfile?.state.trim() &&
    !!renterProfile?.zipCode.trim();

  const monthDays =
    useMemo(
      () =>
        getCalendarDays(
          calendarMonth
        ),
      [calendarMonth]
    );

  const previousMonthDisabled =
    calendarMonth.getFullYear() ===
      currentMonth.getFullYear() &&
    calendarMonth.getMonth() ===
      currentMonth.getMonth();

  const handleRentalRequest =
    async () => {
      setRequestError("");

      if (!tool) return;

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
          "Complete your first name, last name, city, state, and ZIP code in Account Settings before requesting a rental."
        );
        return;
      }

      if (
        !startDate ||
        !endDate
      ) {
        setRequestError(
          "Choose a start and end date on the availability calendar."
        );
        return;
      }

      if (
        rangeHitsReservation(
          startDate,
          endDate
        )
      ) {
        setRequestError(
          "Those dates are no longer available. The calendar has been refreshed."
        );

        await loadTool();

        setStartDate("");
        setEndDate("");
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
              method: "POST",
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
          await loadTool();

          throw new Error(
            data.detail ||
              "Unable to submit rental request."
          );
        }

        setRequestSuccess(
          true
        );
      } catch (submitError) {
        console.error(
          "Rental request failed:",
          submitError
        );

        setRequestError(
          submitError instanceof Error
            ? submitError.message
            : "Unable to submit rental request."
        );
      } finally {
        setRequestLoading(
          false
        );
      }
    };

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

  return (
    <div className="mx-auto max-w-7xl p-8">
      <Link
        href="/tooldrop"
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition hover:text-[#001F3F]"
      >
        <ArrowLeft
          size={17}
        />
        Back to ToolDrop
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex h-[420px] items-center justify-center overflow-hidden rounded-xl bg-gray-100">
              {activePhoto ? (
                <img
                  src={activePhoto}
                  alt={tool.item_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ToolCase
                  size={80}
                  className="text-gray-300"
                />
              )}
            </div>

            {photos.length > 1 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {photos.map(
                  (
                    photo,
                    index
                  ) => (
                    <button
                      key={photo}
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
                        src={photo}
                        alt={`${tool.item_name} photo ${
                          index + 1
                        }`}
                        className="h-24 w-full object-cover"
                      />
                    </button>
                  )
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-start md:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#001F3F]">
                  {tool.category}
                </span>

                <h1 className="mt-3 text-3xl font-bold text-[#001F3F]">
                  {tool.item_name}
                </h1>

                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-2">
                    <Tag size={16} />
                    {tool.condition} condition
                  </span>

                  <span className="flex items-center gap-2">
                    <MapPin size={16} />
                    {tool.location}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 px-5 py-4 text-right">
                <p className="text-3xl font-bold text-[#001F3F]">
                  ${tool.price}
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

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#001F3F] text-white">
                <UserRound size={22} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Listed By
                </p>

                <p className="mt-1 font-bold text-[#001F3F]">
                  {tool.seller_name}
                </p>
              </div>
            </div>
          </section>
        </div>

        <aside>
          <section className="sticky top-8 rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-[#001F3F]">
              Rent This Tool
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Reserved dates are blocked. Choose only the dates that are still available.
            </p>

            {!authLoading &&
              isOwnTool && (
                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="font-semibold text-[#001F3F]">
                    This is your tool
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    You can view the availability calendar, but you cannot request to rent your own tool.
                  </p>

                  <Link
                    href="/myTools"
                    className="mt-3 inline-block text-sm font-semibold text-blue-700 hover:underline"
                  >
                    Manage My Tools
                  </Link>
                </div>
              )}

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
                    The owner can now review your request.
                  </p>
                </div>
              </div>
            )}

            {requestError && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {requestError}

                {!renterProfileComplete &&
                  !isOwnTool && (
                    <div className="mt-3">
                      <Link
                        href="/account"
                        className="font-semibold underline"
                      >
                        Open Account Settings
                      </Link>
                    </div>
                  )}
              </div>
            )}

            {!isOwnTool && (
              <div className="mt-6 rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    disabled={
                      previousMonthDisabled
                    }
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() - 1,
                          1
                        )
                      )
                    }
                    className="rounded-lg border p-2 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft size={17} />
                  </button>

                  <div className="text-center">
                    <p className="font-bold text-[#001F3F]">
                      {calendarMonth.toLocaleDateString(
                        undefined,
                        {
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-400">
                      Choose start, then end date
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() + 1,
                          1
                        )
                      )
                    }
                    className="rounded-lg border p-2 text-gray-600 transition hover:bg-gray-50"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-gray-400">
                  {[
                    "Sun",
                    "Mon",
                    "Tue",
                    "Wed",
                    "Thu",
                    "Fri",
                    "Sat",
                  ].map(
                    (day) => (
                      <div
                        key={day}
                        className="py-2"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {monthDays.map(
                    (day) => {
                      const iso =
                        toIsoDate(day);

                      const sameMonth =
                        day.getMonth() ===
                        calendarMonth.getMonth();

                      const reserved =
                        isDateReserved(iso);

                      const past =
                        iso < today;

                      const selected =
                        !!startDate &&
                        !!endDate &&
                        iso >= startDate &&
                        iso <= endDate;

                      const selectedStart =
                        iso === startDate;

                      const selectedEnd =
                        iso === endDate;

                      const crossesBlockedRange =
                        !!startDate &&
                        !endDate &&
                        iso > startDate &&
                        rangeHitsReservation(
                          startDate,
                          iso
                        );

                      const disabled =
                        !sameMonth ||
                        past ||
                        reserved ||
                        crossesBlockedRange ||
                        requestSuccess;

                      return (
                        <button
                          key={iso}
                          type="button"
                          disabled={disabled}
                          title={
                            reserved
                              ? "Reserved"
                              : crossesBlockedRange
                              ? "This end date would cross reserved dates"
                              : undefined
                          }
                          onClick={() =>
                            handleCalendarDateClick(
                              iso
                            )
                          }
                          className={[
                            "aspect-square rounded-lg text-sm transition",
                            !sameMonth
                              ? "text-transparent"
                              : "",
                            reserved
                              ? "cursor-not-allowed bg-red-50 font-semibold text-red-400 line-through"
                              : "",
                            past &&
                            sameMonth
                              ? "cursor-not-allowed text-gray-300"
                              : "",
                            crossesBlockedRange &&
                            sameMonth &&
                            !reserved
                              ? "cursor-not-allowed bg-gray-50 text-gray-300"
                              : "",
                            selected &&
                            !selectedStart &&
                            !selectedEnd
                              ? "bg-blue-50 text-[#001F3F]"
                              : "",
                            selectedStart ||
                            selectedEnd
                              ? "bg-[#001F3F] font-bold text-white"
                              : "",
                            !disabled &&
                            !selected &&
                            !selectedStart &&
                            !selectedEnd
                              ? "hover:bg-blue-50"
                              : "",
                          ].join(" ")}
                        >
                          {sameMonth
                            ? day.getDate()
                            : ""}
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <span className="flex items-center gap-2 text-gray-500">
                    <span className="h-3 w-3 rounded-sm bg-red-100" />
                    Reserved
                  </span>

                  <span className="flex items-center gap-2 text-gray-500">
                    <span className="h-3 w-3 rounded-sm bg-[#001F3F]" />
                    Selected
                  </span>
                </div>

                {reservedRanges.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Reserved Dates
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {reservedRanges.map(
                        (range) => (
                          <span
                            key={
                              range.request_id
                            }
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600"
                          >
                            {formatDate(
                              range.start_date
                            )}
                            {" – "}
                            {formatDate(
                              range.end_date
                            )}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                {(startDate ||
                  endDate) && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Selected Dates
                        </p>

                        <p className="mt-1 text-sm font-semibold text-gray-800">
                          {startDate
                            ? formatDate(
                                startDate
                              )
                            : "Select start"}
                          {" → "}
                          {endDate
                            ? formatDate(
                                endDate
                              )
                            : "Select end"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setStartDate("");
                          setEndDate("");
                          setRequestError("");
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                  ${tool.price}
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
                  ${tool.deposit || 0}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <Package
                    size={18}
                    className="text-[#001F3F]"
                  />

                  <span className="text-sm text-gray-600">
                    Listing Status
                  </span>
                </div>

                <span className="font-semibold capitalize text-green-700">
                  {tool.availability}
                </span>
              </div>
            </div>

            {!isOwnTool &&
              rentalDays > 0 && (
                <div className="mt-6 rounded-xl border border-gray-200 p-4">
                  <h3 className="font-bold text-[#001F3F]">
                    Rental Summary
                  </h3>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>
                        ${tool.price} ×{" "}
                        {rentalDays}{" "}
                        {rentalDays === 1
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
                          tool.deposit || 0
                        ).toFixed(2)}
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
                    </div>
                  </div>
                </div>
              )}

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
                  <>
                    <CalendarDays
                      size={18}
                    />
                    Request Rental
                  </>
                )}
              </button>
            )}

            {!isOwnTool &&
              !requestSuccess && (
                <p className="mt-3 text-center text-xs text-gray-400">
                  The owner must approve your request before the rental is confirmed.
                </p>
              )}
          </section>
        </aside>
      </div>
    </div>
  );
}
