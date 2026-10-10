"use client";

import { useEffect, useState } from "react";
import {
  Edit3,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";

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
  availability: string;
  description?: string | null;
  specifications?: string | null;
  photo_urls?: string[];
  rating?: number;
  reviews?: number;
};

export default function MyToolsPage() {
  const [tools, setTools] = useState<ToolListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [editingTool, setEditingTool] =
    useState<ToolListing | null>(null);

  const [deletingTool, setDeletingTool] =
    useState<ToolListing | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  // ======================================================
  // LOAD CURRENT USER'S TOOLS
  // ======================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setTools([]);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setErrorMsg("");

          const response = await fetch(
            `${apiUrl}/api/diy/listings/owner/${user.uid}`
          );

          if (!response.ok) {
            const errorData = await response
              .json()
              .catch(() => ({}));

            throw new Error(
              errorData.detail ||
                "Failed to load your tool listings."
            );
          }

          const data = await response.json();

          setTools(data.results || []);
        } catch (error) {
          console.error(
            "Failed to load tool listings:",
            error
          );

          setErrorMsg(
            error instanceof Error
              ? error.message
              : "Failed to load your tool listings."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [apiUrl]);

  // ======================================================
  // GROUP TOOLS BY STATUS
  // ======================================================

  const availableTools = tools.filter(
    (tool) => tool.availability === "available"
  );

  const rentedTools = tools.filter(
    (tool) => tool.availability === "rented"
  );

  const unavailableTools = tools.filter(
    (tool) => tool.availability === "unavailable"
  );

  // ======================================================
  // EDIT TOOL
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
            deposit: Number(
              editingTool.deposit || 0
            ),
            location: editingTool.location.trim(),
            availability:
              editingTool.availability,
            description:
              editingTool.description || "",
            specifications:
              editingTool.specifications || "",
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
          (tool) =>
            tool.id !== deletingTool.id
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
    return (
      <article
        key={tool.id}
        className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      >
        {/* IMAGE AREA */}

        <div className="flex h-44 items-center justify-center bg-gray-100">
          <Package
            size={52}
            className="text-gray-300"
          />
        </div>

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

          {/* STATUS */}

          <div className="mt-5 rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-800">
              Status
            </p>

            {tool.availability ===
              "available" && (
              <p className="text-xs font-medium text-green-600">
                Available for rent
              </p>
            )}

            {tool.availability ===
              "rented" && (
              <p className="text-xs font-medium text-blue-600">
                Currently rented
              </p>
            )}

            {tool.availability ===
              "unavailable" && (
              <p className="text-xs font-medium text-gray-500">
                Unavailable
              </p>
            )}
          </div>

          {/* AVAILABILITY TOGGLE */}

          {tool.availability !== "rented" && (
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
                  tool.availability ===
                  "available"
                    ? "bg-[#001F3F]"
                    : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                    tool.availability ===
                    "available"
                      ? "left-6"
                      : "left-1"
                  }`}
                />
              </button>
            </div>
          )}

          {/* ACTION BUTTONS */}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setEditingTool(tool)
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
            availability, pricing, and rental
            status.
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

      {/* ERROR */}

      {errorMsg && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* LOADING */}

      {loading && (
        <div className="mt-8 flex items-center justify-center rounded-2xl border bg-white p-12 text-gray-500 shadow-sm">
          <Loader2
            size={22}
            className="mr-3 animate-spin"
          />

          Loading your tools...
        </div>
      )}

      {/* EMPTY STATE */}

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
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 font-semibold text-white transition hover:bg-[#003366]"
          >
            <Plus size={17} />
            List a Tool
          </Link>
        </div>
      )}

      {/* TOOL SECTIONS */}

      {!loading && tools.length > 0 && (
        <div className="mt-8 space-y-10">
          {/* AVAILABLE */}

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Available
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Tools currently available for
                  other MotorMate users to rent.
                </p>
              </div>

              <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                {availableTools.length}
              </span>
            </div>

            {availableTools.length > 0 ? (
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {availableTools.map(
                  renderToolCard
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                You don't currently have any
                available tools.
              </div>
            )}
          </section>

          {/* CURRENTLY RENTED */}

          <section>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#001F3F]">
                  Currently Rented
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Tools you own that are currently
                  being used by another MotorMate
                  user.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {rentedTools.length}
              </span>
            </div>

            {rentedTools.length > 0 ? (
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {rentedTools.map(
                  renderToolCard
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                None of your tools are currently
                rented.
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
                  Listings you've temporarily
                  removed from rental availability.
                </p>
              </div>

              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                {unavailableTools.length}
              </span>
            </div>

            {unavailableTools.length > 0 ? (
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {unavailableTools.map(
                  renderToolCard
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-gray-500">
                You don't have any unavailable
                tools.
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

            <div className="mt-6 space-y-4">
              {/* TOOL NAME */}

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
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#001F3F]"
                />
              </div>

              {/* CATEGORY + CONDITION */}

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
                        category:
                          e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#001F3F]"
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
                        condition:
                          e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border bg-white px-4 py-3 outline-none focus:border-[#001F3F]"
                  >
                    <option>Like New</option>
                    <option>Excellent</option>
                    <option>Good</option>
                    <option>Fair</option>
                  </select>
                </div>
              </div>

              {/* PRICE + DEPOSIT */}

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
                        price: Number(
                          e.target.value
                        ),
                      })
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#001F3F]"
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
                        deposit: Number(
                          e.target.value
                        ),
                      })
                    }
                    className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#001F3F]"
                  />
                </div>
              </div>

              {/* LOCATION */}

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
                  className="mt-2 w-full rounded-xl border px-4 py-3 outline-none focus:border-[#001F3F]"
                />
              </div>

              {/* DESCRIPTION */}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Description
                </label>

                <textarea
                  rows={4}
                  value={
                    editingTool.description || ""
                  }
                  onChange={(e) =>
                    setEditingTool({
                      ...editingTool,
                      description:
                        e.target.value,
                    })
                  }
                  className="mt-2 w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-[#001F3F]"
                />
              </div>

              {/* SPECIFICATIONS */}

              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Specifications
                </label>

                <textarea
                  rows={3}
                  value={
                    editingTool.specifications ||
                    ""
                  }
                  onChange={(e) =>
                    setEditingTool({
                      ...editingTool,
                      specifications:
                        e.target.value,
                    })
                  }
                  className="mt-2 w-full resize-none rounded-xl border px-4 py-3 outline-none focus:border-[#001F3F]"
                />
              </div>
            </div>

            {/* EDIT BUTTONS */}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setEditingTool(null)
                }
                className="rounded-lg border px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleSaveEdit}
                className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:opacity-60"
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

      {/* DELETE CONFIRMATION */}

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
              This removes it from ToolDrop and
              cannot be undone.
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
                className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
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