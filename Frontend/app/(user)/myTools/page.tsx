"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  CheckCircle2,
  Edit3,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { auth } from "@/lib/firebase";

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
  availability: "available" | "rented" | "unavailable";
  description?: string | null;
  specifications?: string | null;
  photo_urls?: string[];
  rating?: number;
  reviews?: number;
};

type RentalRequest = {
  id: string;
  listing_id: string;
  owner_id: string;
  renter_id: string;
  renter_name: string;
  seller_name: string;
  tool_name: string;
  photo_urls?: string[];
  location?: string;
  start_date: string;
  end_date: string;
  daily_rate: number;
  deposit: number;
  rental_days: number;
  rental_price: number;
  total_with_deposit: number;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "active"
    | "completed"
    | "cancelled";
  created_at?: string;
};

function getTodayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60 * 1000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .split("T")[0];
}

export default function MyToolsPage() {
  const [tools, setTools] = useState<ToolListing[]>([]);
  const [rentalRequests, setRentalRequests] = useState<RentalRequest[]>([]);

  const [loading, setLoading] = useState(true);
  const [rentalRequestsLoading, setRentalRequestsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [editingTool, setEditingTool] = useState<ToolListing | null>(null);
  const [deletingTool, setDeletingTool] = useState<ToolListing | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [requestActionId, setRequestActionId] = useState<string | null>(null);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  // ======================================================
  // LOAD TOOLS + RENTAL REQUESTS
  // ======================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setTools([]);
          setRentalRequests([]);
          setLoading(false);
          setRentalRequestsLoading(false);
          return;
        }

        try {
          setLoading(true);
          setRentalRequestsLoading(true);
          setErrorMsg("");

          const [toolsResponse, requestsResponse] = await Promise.all([
            fetch(
              `${apiUrl}/api/diy/listings/owner/${user.uid}`
            ),
            fetch(
              `${apiUrl}/api/diy/rental-requests/owner/${user.uid}`
            ),
          ]);

          if (!toolsResponse.ok) {
            const errorData = await toolsResponse
              .json()
              .catch(() => ({}));

            throw new Error(
              errorData.detail ||
                "Failed to load your tool listings."
            );
          }

          if (!requestsResponse.ok) {
            const errorData = await requestsResponse
              .json()
              .catch(() => ({}));

            throw new Error(
              errorData.detail ||
                "Failed to load rental requests."
            );
          }

          const toolsData = await toolsResponse.json();
          const requestsData = await requestsResponse.json();

          setTools(toolsData.results || []);
          setRentalRequests(requestsData.results || []);
        } catch (error) {
          console.error("Failed to load My Tools data:", error);

          setErrorMsg(
            error instanceof Error
              ? error.message
              : "Failed to load your tools."
          );
        } finally {
          setLoading(false);
          setRentalRequestsLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [apiUrl]);

  // ======================================================
  // GROUP DATA
  // ======================================================

  const today = getTodayString();

  const pendingRentalRequests = rentalRequests.filter(
    (request) => request.status === "pending"
  );

  const approvedRentalRequests = rentalRequests.filter(
    (request) =>
      request.status === "approved" ||
      request.status === "active"
  );

  const currentRentalRequests =
    approvedRentalRequests.filter(
      (request) =>
        request.start_date <= today &&
        request.end_date >= today
    );

  const upcomingRentalRequests =
    approvedRentalRequests.filter(
      (request) => request.start_date > today
    );

  const currentRentalListingIds = new Set(
    currentRentalRequests.map(
      (request) => request.listing_id
    )
  );

  const availableTools = tools.filter(
    (tool) =>
      tool.availability === "available" &&
      !currentRentalListingIds.has(tool.id)
  );

  const rentedTools = tools.filter(
    (tool) =>
      currentRentalListingIds.has(tool.id)
  );

  const unavailableTools = tools.filter(
    (tool) => tool.availability === "unavailable"
  );

  // ======================================================
  // APPROVE REQUEST
  // ======================================================

  const handleApproveRequest = async (
    request: RentalRequest
  ) => {
    const user = auth.currentUser;

    if (!user) {
      setErrorMsg(
        "You must be signed in to approve a rental."
      );
      return;
    }

    try {
      setRequestActionId(request.id);
      setErrorMsg("");

      const response = await fetch(
        `${apiUrl}/api/diy/rental-requests/${request.id}/approve?owner_id=${encodeURIComponent(
          user.uid
        )}`,
        {
          method: "PATCH",
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to approve rental request."
        );
      }

      const [requestsResponse, toolsResponse] =
        await Promise.all([
          fetch(
            `${apiUrl}/api/diy/rental-requests/owner/${user.uid}`
          ),
          fetch(
            `${apiUrl}/api/diy/listings/owner/${user.uid}`
          ),
        ]);

      if (!requestsResponse.ok) {
        throw new Error(
          "Rental approved, but rental requests could not be refreshed."
        );
      }

      if (!toolsResponse.ok) {
        throw new Error(
          "Rental approved, but your tools could not be refreshed."
        );
      }

      const requestsData =
        await requestsResponse.json();

      const toolsData =
        await toolsResponse.json();

      setRentalRequests(
        requestsData.results || []
      );

      setTools(
        toolsData.results || []
      );
    } catch (error) {
      console.error(
        "Failed to approve request:",
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to approve rental request."
      );
    } finally {
      setRequestActionId(null);
    }
  };

  // ======================================================
  // REJECT REQUEST
  // ======================================================

  const handleRejectRequest = async (
    request: RentalRequest
  ) => {
    const user = auth.currentUser;

    if (!user) {
      setErrorMsg(
        "You must be signed in to reject a rental."
      );
      return;
    }

    try {
      setRequestActionId(request.id);
      setErrorMsg("");

      const response = await fetch(
        `${apiUrl}/api/diy/rental-requests/${request.id}/reject?owner_id=${encodeURIComponent(
          user.uid
        )}`,
        {
          method: "PATCH",
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to reject rental request."
        );
      }

      setRentalRequests((currentRequests) =>
        currentRequests.map((currentRequest) =>
          currentRequest.id === request.id
            ? {
                ...currentRequest,
                status: "rejected",
              }
            : currentRequest
        )
      );
    } catch (error) {
      console.error("Failed to reject request:", error);

      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to reject rental request."
      );
    } finally {
      setRequestActionId(null);
    }
  };

  // ======================================================
  // CANCEL RENTAL
  // ======================================================

  const handleCancelRental = async (
    request: RentalRequest
  ) => {
    const user = auth.currentUser;

    if (!user) {
      setErrorMsg(
        "You must be signed in to cancel a rental."
      );
      return;
    }

    const isCurrent =
      request.start_date <= today &&
      request.end_date >= today;

    const confirmed = window.confirm(
      isCurrent
        ? `Cancel the current rental for ${request.tool_name}? Use this if the renter did not pick up the tool or the rental needs to be ended.`
        : `Cancel the approved rental for ${request.tool_name} from ${request.start_date} through ${request.end_date}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setRequestActionId(request.id);
      setErrorMsg("");

      const response = await fetch(
        `${apiUrl}/api/diy/rental-requests/${request.id}/cancel?owner_id=${encodeURIComponent(
          user.uid
        )}`,
        {
          method: "PATCH",
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to cancel rental."
        );
      }

      const [requestsResponse, toolsResponse] =
        await Promise.all([
          fetch(
            `${apiUrl}/api/diy/rental-requests/owner/${user.uid}`
          ),
          fetch(
            `${apiUrl}/api/diy/listings/owner/${user.uid}`
          ),
        ]);

      if (!requestsResponse.ok) {
        throw new Error(
          "Rental cancelled, but rental requests could not be refreshed."
        );
      }

      if (!toolsResponse.ok) {
        throw new Error(
          "Rental cancelled, but your tools could not be refreshed."
        );
      }

      const requestsData =
        await requestsResponse.json();

      const toolsData =
        await toolsResponse.json();

      setRentalRequests(
        requestsData.results || []
      );

      setTools(
        toolsData.results || []
      );
    } catch (error) {
      console.error(
        "Failed to cancel rental:",
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to cancel rental."
      );
    } finally {
      setRequestActionId(null);
    }
  };

  // ======================================================
  // EDIT PHOTO UPLOAD
  // ======================================================

  const handleEditPhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file || !editingTool) return;

    const existingPhotos = editingTool.photo_urls || [];

    if (existingPhotos.length >= 3) {
      setErrorMsg(
        "You can upload a maximum of 3 photos."
      );
      event.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMsg(
        "Please select a valid image file."
      );
      event.target.value = "";
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
      event.target.value = "";
      return;
    }

    try {
      setUploadingPhoto(true);
      setErrorMsg("");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Photo upload failed.");
      }

      const data = await response.json();

      setEditingTool((current) => {
        if (!current) return current;

        return {
          ...current,
          photo_urls: [
            ...(current.photo_urls || []),
            data.secure_url,
          ],
        };
      });
    } catch (error) {
      console.error("Edit photo upload failed:", error);
      setErrorMsg("Could not upload the photo.");
    } finally {
      setUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const removeEditPhoto = (
    photoIndex: number
  ) => {
    setEditingTool((current) => {
      if (!current) return current;

      return {
        ...current,
        photo_urls: (current.photo_urls || []).filter(
          (_, index) => index !== photoIndex
        ),
      };
    });
  };

  // ======================================================
  // SAVE EDIT
  // ======================================================

  const handleSaveEdit = async () => {
    if (!editingTool) return;

    const user = auth.currentUser;

    if (!user) {
      setErrorMsg(
        "You must be signed in to edit a listing."
      );
      return;
    }

    if (
      !editingTool.item_name.trim() ||
      !editingTool.category.trim() ||
      !editingTool.location.trim()
    ) {
      setErrorMsg(
        "Tool name, category, and location are required."
      );
      return;
    }

    if (Number(editingTool.price) <= 0) {
      setErrorMsg(
        "Daily rental price must be greater than 0."
      );
      return;
    }

    try {
      setSaving(true);
      setErrorMsg("");

      const response = await fetch(
        `${apiUrl}/api/diy/listings/${editingTool.id}?owner_id=${encodeURIComponent(
          user.uid
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_name: editingTool.item_name.trim(),
            category: editingTool.category,
            condition: editingTool.condition,
            price: Number(editingTool.price),
            deposit: Number(editingTool.deposit || 0),
            location: editingTool.location.trim(),
            availability: editingTool.availability,
            description: editingTool.description || "",
            specifications:
              editingTool.specifications || "",
            photo_urls: editingTool.photo_urls || [],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.detail ||
            "Failed to update listing."
        );
      }

      const data = await response.json();

      setTools((currentTools) =>
        currentTools.map((tool) =>
          tool.id === editingTool.id
            ? data.listing
            : tool
        )
      );

      setEditingTool(null);
    } catch (error) {
      console.error(
        "Failed to update tool listing:",
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to update listing."
      );
    } finally {
      setSaving(false);
    }
  };

  // ======================================================
  // DELETE TOOL
  // ======================================================

  const handleDelete = async () => {
    if (!deletingTool) return;

    const user = auth.currentUser;

    if (!user) {
      setErrorMsg(
        "You must be signed in to delete a listing."
      );
      return;
    }

    try {
      setDeleting(true);
      setErrorMsg("");

      const response = await fetch(
        `${apiUrl}/api/diy/listings/${deletingTool.id}?owner_id=${encodeURIComponent(
          user.uid
        )}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.detail ||
            "Failed to delete listing."
        );
      }

      setTools((currentTools) =>
        currentTools.filter(
          (tool) => tool.id !== deletingTool.id
        )
      );

      setDeletingTool(null);
    } catch (error) {
      console.error(
        "Failed to delete tool listing:",
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to delete listing."
      );
    } finally {
      setDeleting(false);
    }
  };

  // ======================================================
  // TOGGLE AVAILABILITY
  // ======================================================

  const toggleAvailability = async (
    tool: ToolListing
  ) => {
    const user = auth.currentUser;

    if (!user) {
      setErrorMsg(
        "You must be signed in to update a listing."
      );
      return;
    }

    const newAvailability =
      tool.availability === "available"
        ? "unavailable"
        : "available";

    try {
      setErrorMsg("");

      const response = await fetch(
        `${apiUrl}/api/diy/listings/${tool.id}?owner_id=${encodeURIComponent(
          user.uid
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            availability: newAvailability,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({}));

        throw new Error(
          errorData.detail ||
            "Failed to update availability."
        );
      }

      const data = await response.json();

      setTools((currentTools) =>
        currentTools.map((item) =>
          item.id === tool.id
            ? data.listing
            : item
        )
      );
    } catch (error) {
      console.error(
        "Failed to update availability:",
        error
      );

      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Failed to update availability."
      );
    }
  };

  // ======================================================
  // TOOL CARD
  // ======================================================

  const renderToolCard = (
    tool: ToolListing
  ) => {
    const mainPhoto = tool.photo_urls?.[0];

    const currentRental =
      currentRentalRequests.find(
        (request) => request.listing_id === tool.id
      );

    const isCurrentlyRented =
      Boolean(currentRental);

    return (
      <article
        key={tool.id}
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      >
        {mainPhoto ? (
          <div className="h-44 overflow-hidden bg-gray-100">
            <img
              src={mainPhoto}
              alt={tool.item_name}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center bg-gray-100">
            <Package
              size={52}
              className="text-gray-300"
            />
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                {tool.category}
              </p>

              <h2 className="mt-1 text-lg font-bold text-gray-900">
                {tool.item_name}
              </h2>
            </div>

            <div className="text-right">
              <p className="text-xl font-bold text-[#001F3F]">
                ${tool.price}
              </p>

              <p className="text-xs text-gray-400">
                per day
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 text-sm text-gray-500">
            <p>
              <span className="font-semibold text-gray-700">
                Condition:
              </span>{" "}
              {tool.condition}
            </p>

            <p>
              <span className="font-semibold text-gray-700">
                Location:
              </span>{" "}
              {tool.location}
            </p>

            <p>
              <span className="font-semibold text-gray-700">
                Deposit:
              </span>{" "}
              ${tool.deposit || 0}
            </p>
          </div>

          <div className="mt-5 rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-800">
              Status
            </p>

            {isCurrentlyRented ? (
              <p className="text-xs font-medium text-blue-600">
                Currently rented
              </p>
            ) : tool.availability === "available" ? (
              <p className="text-xs font-medium text-green-600">
                Available for rent
              </p>
            ) : (
              <p className="text-xs font-medium text-gray-500">
                Unavailable
              </p>
            )}
          </div>

          {currentRental && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-sm font-bold text-[#001F3F]">
                Current Rental
              </p>

              <div className="mt-2 space-y-1 text-xs text-gray-600">
                <p>
                  Renter:{" "}
                  <span className="font-semibold text-gray-800">
                    {currentRental.renter_name}
                  </span>
                </p>

                <p>
                  Dates: {currentRental.start_date}
                  {" → "}
                  {currentRental.end_date}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  requestActionId === currentRental.id
                }
                onClick={() =>
                  handleCancelRental(currentRental)
                }
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {requestActionId === currentRental.id ? (
                  <>
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle size={15} />
                    Cancel Current Rental
                  </>
                )}
              </button>
            </div>
          )}

          {!isCurrentlyRented && (
            <div className="mt-4 flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Public Availability
                </p>

                <p className="text-xs text-gray-500">
                  Show this tool in ToolDrop.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  toggleAvailability(tool)
                }
                className={`relative h-7 w-12 rounded-full transition ${
                  tool.availability === "available"
                    ? "bg-[#001F3F]"
                    : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                    tool.availability === "available"
                      ? "left-6"
                      : "left-1"
                  }`}
                />
              </button>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setEditingTool({
                  ...tool,
                  photo_urls: tool.photo_urls || [],
                })
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold text-[#001F3F] transition hover:bg-gray-50"
            >
              <Edit3 size={15} />
              Edit
            </button>

            <button
              type="button"
              onClick={() =>
                setDeletingTool(tool)
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </div>
      </article>
    );
  };

  // ======================================================
  // PAGE
  // ======================================================

  return (
    <div className="mx-auto max-w-7xl p-8">
      {/* HEADER */}

      

      <section className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
            Tool Owner
          </p>

          <h1 className="mt-1 text-3xl font-bold text-[#001F3F]">
            My Tools
          </h1>

          <p className="mt-2 max-w-2xl text-gray-500">
            Manage your ToolDrop listings,
            incoming rental requests, availability,
            pricing, and rental status.
          </p>
        </div>

        <Link
          href="/toolListing"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 font-semibold text-white transition hover:bg-[#003366]"
        >
          <Plus size={18} />
          List New Tool
        </Link>
      </section>

      {/* RENTAL HISTORY & EARNINGS */}
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#001F3F] text-white">
            <BarChart3 size={23} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-[#001F3F]">
              Rental History &amp; Earnings
            </h2>
            <p className="mt-1 max-w-xl text-sm text-gray-600">
              Review your rental history, booked revenue, rental days, cancellations,
              and performance across all your tools.
            </p>
          </div>
        </div>

        <Link
          href="/toolAnalytics"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#003366]"
        >
          View Analytics
          <ArrowUpRight size={17} />
        </Link>
      </div>

      {/* ERROR */}

      {errorMsg && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* RENTAL REQUESTS */}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell
                size={21}
                className="text-[#001F3F]"
              />

              <h2 className="text-xl font-bold text-[#001F3F]">
                Rental Requests
              </h2>
            </div>

            <p className="mt-1 text-sm text-gray-500">
              Review requests from users who want
              to rent your tools.
            </p>
          </div>

          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
            {pendingRentalRequests.length}
          </span>
        </div>

        {rentalRequestsLoading ? (
          <div className="mt-5 flex items-center justify-center rounded-2xl border bg-white p-8 text-gray-500">
            <Loader2
              size={19}
              className="mr-2 animate-spin"
            />
            Loading rental requests...
          </div>
        ) : pendingRentalRequests.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center">
            <Bell
              size={32}
              className="mx-auto text-gray-300"
            />

            <p className="mt-3 font-semibold text-gray-700">
              No pending rental requests
            </p>

            <p className="mt-1 text-sm text-gray-500">
              New requests for your tools will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {pendingRentalRequests.map((request) => {
              const photo = request.photo_urls?.[0];
              const processing =
                requestActionId === request.id;

              return (
                <article
                  key={request.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                    {photo ? (
                      <img
                        src={photo}
                        alt={request.tool_name}
                        className="h-24 w-32 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-32 items-center justify-center rounded-xl bg-gray-100">
                        <Package
                          size={32}
                          className="text-gray-300"
                        />
                      </div>
                    )}

                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Rental Request
                      </p>

                      <h3 className="mt-1 text-lg font-bold text-[#001F3F]">
                        {request.tool_name}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <UserRound size={15} />
                          Requested by{" "}
                          <span className="font-semibold text-gray-700">
                            {request.renter_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <CalendarDays size={15} />
                          {request.start_date}
                          {" → "}
                          {request.end_date}
                        </div>
                      </div>
                    </div>

                    <div className="min-w-[180px] rounded-xl bg-gray-50 p-4">
                      <div className="flex justify-between gap-5 text-sm text-gray-500">
                        <span>Rental</span>
                        <span>
                          $
                          {Number(
                            request.rental_price
                          ).toFixed(2)}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between gap-5 text-sm text-gray-500">
                        <span>Deposit</span>
                        <span>
                          $
                          {Number(
                            request.deposit
                          ).toFixed(2)}
                        </span>
                      </div>

                      <div className="mt-3 flex justify-between gap-5 border-t pt-3">
                        <span className="font-semibold text-gray-700">
                          Total
                        </span>

                        <span className="font-bold text-[#001F3F]">
                          $
                          {Number(
                            request.total_with_deposit
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 lg:flex-col">
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() =>
                          handleApproveRequest(request)
                        }
                        className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                      >
                        {processing ? (
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        Accept
                      </button>

                      <button
                        type="button"
                        disabled={processing}
                        onClick={() =>
                          handleRejectRequest(request)
                        }
                        className="flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* UPCOMING APPROVED RENTALS */}

      {!rentalRequestsLoading &&
        upcomingRentalRequests.length > 0 && (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays
                    size={21}
                    className="text-[#001F3F]"
                  />

                  <h2 className="text-xl font-bold text-[#001F3F]">
                    Upcoming Rentals
                  </h2>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Approved reservations that have not started yet.
                  The tool can still be available outside these dates.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {upcomingRentalRequests.length}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {upcomingRentalRequests.map(
                (request) => {
                  const photo =
                    request.photo_urls?.[0];

                  return (
                    <article
                      key={request.id}
                      className="rounded-2xl border bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-col gap-5 md:flex-row md:items-center">
                        {photo ? (
                          <img
                            src={photo}
                            alt={request.tool_name}
                            className="h-24 w-32 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-24 w-32 items-center justify-center rounded-xl bg-gray-100">
                            <Package
                              size={32}
                              className="text-gray-300"
                            />
                          </div>
                        )}

                        <div className="flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                            Approved Rental
                          </p>

                          <h3 className="mt-1 text-lg font-bold text-[#001F3F]">
                            {request.tool_name}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                              <UserRound size={15} />
                              Renter{" "}
                              <span className="font-semibold text-gray-700">
                                {request.renter_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <CalendarDays size={15} />
                              {request.start_date}
                              {" → "}
                              {request.end_date}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="rounded-xl bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-700">
                            Upcoming
                          </div>

                          <button
                            type="button"
                            disabled={
                              requestActionId === request.id
                            }
                            onClick={() =>
                              handleCancelRental(
                                request
                              )
                            }
                            className="flex min-w-[150px] items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {requestActionId ===
                            request.id ? (
                              <>
                                <Loader2
                                  size={16}
                                  className="animate-spin"
                                />
                                Cancelling...
                              </>
                            ) : (
                              <>
                                <XCircle size={16} />
                                Cancel Rental
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          </section>
        )}

      {/* LOADING TOOLS */}

      {loading && (
        <div className="mt-8 flex items-center justify-center rounded-2xl border bg-white p-12 text-gray-500 shadow-sm">
          <Loader2
            size={22}
            className="mr-3 animate-spin"
          />
          Loading your tools...
        </div>
      )}

      {/* EMPTY TOOLS */}

      {!loading && tools.length === 0 && (
        <div className="mt-8 rounded-2xl border bg-white p-12 text-center shadow-sm">
          <Package
            size={46}
            className="mx-auto text-gray-300"
          />

          <h2 className="mt-4 text-xl font-bold text-[#001F3F]">
            You haven't listed any tools yet
          </h2>

          <p className="mt-2 text-gray-500">
            Create your first ToolDrop listing and
            make your equipment available to other
            MotorMate users.
          </p>

          <Link
            href="/toolListing"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 font-semibold text-white"
          >
            <Plus size={17} />
            List a Tool
          </Link>
        </div>
      )}

      {/* TOOL SECTIONS */}

      {!loading && tools.length > 0 && (
        <div className="mt-10 space-y-10">
          {/* AVAILABLE */}

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Available
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Tools currently available for other
                  MotorMate users to rent.
                </p>
              </div>

              <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                {availableTools.length}
              </span>
            </div>

            {availableTools.length > 0 ? (
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {availableTools.map(renderToolCard)}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                You don't currently have any available tools.
              </div>
            )}
          </section>

          {/* RENTED */}

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Currently Rented
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Approved rentals whose date range includes
                  today.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {rentedTools.length}
              </span>
            </div>

            {rentedTools.length > 0 ? (
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {rentedTools.map(renderToolCard)}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                None of your tools are currently rented.
              </div>
            )}
          </section>

          {/* UNAVAILABLE */}

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Unavailable
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Listings you've temporarily removed
                  from rental availability.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                {unavailableTools.length}
              </span>
            </div>

            {unavailableTools.length > 0 ? (
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {unavailableTools.map(renderToolCard)}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                You don't have any unavailable tools.
              </div>
            )}
          </section>
        </div>
      )}

      {/* EDIT MODAL */}

      {editingTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  Tool Owner
                </p>

                <h2 className="text-xl font-bold text-[#001F3F]">
                  Edit Listing
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEditingTool(null)
                }
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Tool Photos
                </label>

                <p className="mt-1 text-xs text-gray-400">
                  Add, remove, or replace up to 3 photos.
                </p>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((index) => {
                    const photo =
                      editingTool.photo_urls?.[index];

                    if (photo) {
                      return (
                        <div
                          key={index}
                          className="relative h-28 overflow-hidden rounded-xl border bg-gray-100"
                        >
                          <img
                            src={photo}
                            alt={`Tool photo ${index + 1}`}
                            className="h-full w-full object-cover"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removeEditPhoto(index)
                            }
                            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <label
                        key={index}
                        className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 transition hover:border-[#001F3F] hover:bg-blue-50"
                      >
                        {uploadingPhoto ? (
                          <Loader2
                            size={20}
                            className="animate-spin"
                          />
                        ) : (
                          <Camera size={20} />
                        )}

                        <span className="mt-1 text-xs font-medium">
                          Add Photo
                        </span>

                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleEditPhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Tool Name
                </label>

                <input
                  type="text"
                  value={editingTool.item_name}
                  onChange={(e) =>
                    setEditingTool({
                      ...editingTool,
                      item_name: e.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Category
                  </label>

                  <input
                    type="text"
                    value={editingTool.category}
                    onChange={(e) =>
                      setEditingTool({
                        ...editingTool,
                        category: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Condition
                  </label>

                  <select
                    value={editingTool.condition}
                    onChange={(e) =>
                      setEditingTool({
                        ...editingTool,
                        condition: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border bg-white px-4 py-3"
                  >
                    <option>Like New</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Daily Price
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editingTool.price}
                    onChange={(e) =>
                      setEditingTool({
                        ...editingTool,
                        price: Number(e.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700">
                    Deposit
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingTool.deposit}
                    onChange={(e) =>
                      setEditingTool({
                        ...editingTool,
                        deposit: Number(e.target.value),
                      })
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Location
                </label>

                <input
                  type="text"
                  value={editingTool.location}
                  onChange={(e) =>
                    setEditingTool({
                      ...editingTool,
                      location: e.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Description
                </label>

                <textarea
                  rows={4}
                  value={editingTool.description || ""}
                  onChange={(e) =>
                    setEditingTool({
                      ...editingTool,
                      description: e.target.value,
                    })
                  }
                  className="mt-2 w-full resize-none rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Specifications
                </label>

                <textarea
                  rows={3}
                  value={editingTool.specifications || ""}
                  onChange={(e) =>
                    setEditingTool({
                      ...editingTool,
                      specifications: e.target.value,
                    })
                  }
                  className="mt-2 w-full resize-none rounded-xl border px-4 py-3"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={
                  saving ||
                  uploadingPhoto
                }
                onClick={() =>
                  setEditingTool(null)
                }
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  saving ||
                  uploadingPhoto
                }
                onClick={handleSaveEdit}
                className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}

      {deletingTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={22} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-[#001F3F]">
              Delete listing?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-800">
                {deletingTool.item_name}
              </span>
              ?
            </p>

            <p className="mt-2 text-sm text-red-600">
              This removes it from ToolDrop and cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setDeletingTool(null)
                }
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Listing
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
