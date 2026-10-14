"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  CalendarDays,
  DollarSign,
  Edit3,
  FileText,
  Gauge,
  Loader2,
  PackageCheck,
  Plus,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { auth } from "@/lib/firebase";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type ServiceHistorySummary = {
  total: number;
  lastServiceTitle: string | null;
  lastServiceDate: string | null;
};

type RecordType = "maintenance" | "part_replacement";

type ServiceRecord = {
  _id: string;
  vehicle_id: string;
  owner_id: string;

  record_type: RecordType;

  title: string;
  service_date: string;
  mileage: number;

  cost?: number | null;
  provider?: string | null;
  part_name?: string | null;
  notes?: string | null;

  created_at?: string;
  updated_at?: string;
};

type ServiceHistoryProps = {
  isActive: boolean;
  vehicleId: string;
  ownerId?: string;
  vehicleName: string;
  currentMileage: number;

  onSummaryChange: (summary: ServiceHistorySummary) => void;
  onMileageUpdated?: (newMileage: number) => void;
};

type ServiceForm = {
  recordType: RecordType;
  title: string;
  serviceDate: string;
  mileage: string;
  cost: string;
  provider: string;
  partName: string;
  notes: string;
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyForm(mileage: number): ServiceForm {
  return {
    recordType: "maintenance",
    title: "",
    serviceDate: todayString(),
    mileage: String(mileage || 0),
    cost: "",
    provider: "",
    partName: "",
    notes: "",
  };
}

function formatDate(value: string) {
  if (!value) return "Unknown date";

  const parsed = new Date(`${value}T00:00:00`);

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function responseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  return data.detail || fallback;
}

async function fetchServiceRecords(
  vehicleId: string,
  ownerId: string
): Promise<ServiceRecord[]> {
  const response = await fetch(
    `${apiUrl}/api/service-history/vehicle/${vehicleId}?owner_id=${encodeURIComponent(
      ownerId
    )}`
  );

  if (!response.ok) {
    throw new Error(
      await responseError(response, "Failed to load service history.")
    );
  }

  const data = await response.json();
  return Array.isArray(data.records) ? data.records : [];
}

export default function ServiceHistory({
  isActive,
  vehicleId,
  ownerId,
  vehicleName,
  currentMileage,
  onSummaryChange,
  onMileageUpdated,
}: ServiceHistoryProps) {
  const resolvedOwnerId = ownerId || auth.currentUser?.uid || "";

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingMileageUpdate, setPendingMileageUpdate] = useState<number | null>(
    null
  );
  const [mileageUpdateLoading, setMileageUpdateLoading] = useState(false);
  const [mileageUpdateError, setMileageUpdateError] = useState("");
  const [form, setForm] = useState<ServiceForm>(() =>
    createEmptyForm(currentMileage)
  );

  const updateRecords = useCallback(
    (nextRecords: ServiceRecord[]) => {
      setRecords(nextRecords);

      const latest = nextRecords.length > 0 ? nextRecords[0] : null;

      onSummaryChange({
        total: nextRecords.length,
        lastServiceTitle: latest?.title ?? null,
        lastServiceDate: latest?.service_date ?? null,
      });
    },
    [onSummaryChange]
  );

  const loadRecords = useCallback(async () => {
    if (!vehicleId || !resolvedOwnerId) {
      return;
    }

    setLoading(true);

    try {
      const nextRecords = await fetchServiceRecords(
        vehicleId,
        resolvedOwnerId
      );

      updateRecords(nextRecords);
      setError("");
    } catch (loadError) {
      console.error("Service history load error:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load service history."
      );
    } finally {
      setLoading(false);
    }
  }, [vehicleId, resolvedOwnerId, updateRecords]);

  useEffect(() => {
    if (!vehicleId || !resolvedOwnerId) {
      return;
    }

    let cancelled = false;

    fetchServiceRecords(vehicleId, resolvedOwnerId)
      .then((nextRecords) => {
        if (cancelled) return;

        updateRecords(nextRecords);
        setError("");
      })
      .catch((loadError) => {
        if (cancelled) return;

        console.error("Service history load error:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load service history."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [vehicleId, resolvedOwnerId, updateRecords]);

  const openCreateModal = () => {
    setEditingRecord(null);
    setForm(createEmptyForm(currentMileage));
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (record: ServiceRecord) => {
    setEditingRecord(record);

    setForm({
      recordType: record.record_type,
      title: record.title,
      serviceDate: record.service_date,
      mileage: String(record.mileage),
      cost:
        record.cost !== null && record.cost !== undefined
          ? String(record.cost)
          : "",
      provider: record.provider || "",
      partName: record.part_name || "",
      notes: record.notes || "",
    });

    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingRecord(null);
    setError("");
  };

  const handleFormChange = (
    event:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLSelectElement>
      | ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!vehicleId) {
      setError("This vehicle is missing its database ID.");
      return;
    }

    if (!resolvedOwnerId) {
      setError("You must be signed in to save service history.");
      return;
    }

    if (!form.title.trim()) {
      setError("Please enter the maintenance task.");
      return;
    }

    const mileage = Number(form.mileage);

    if (!Number.isFinite(mileage) || mileage < 0) {
      setError("Please enter a valid mileage.");
      return;
    }

    const cost = form.cost.trim() === "" ? null : Number(form.cost);

    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      setError("Please enter a valid cost.");
      return;
    }

    if (
      form.recordType === "part_replacement" &&
      !form.partName.trim()
    ) {
      setError("Please enter the part that was replaced.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        owner_id: resolvedOwnerId,
        record_type: form.recordType,
        title: form.title.trim(),
        service_date: form.serviceDate,
        mileage,
        cost,
        provider: form.provider.trim() || null,
        part_name:
          form.recordType === "part_replacement"
            ? form.partName.trim()
            : null,
        notes: form.notes.trim() || null,
      };

      const editing = editingRecord !== null;

      const endpoint = editing
        ? `${apiUrl}/api/service-history/${editingRecord._id}`
        : `${apiUrl}/api/service-history/`;

      const response = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          editing
            ? payload
            : {
                ...payload,
                vehicle_id: vehicleId,
              }
        ),
      });

      if (!response.ok) {
        throw new Error(
          await responseError(
            response,
            editing
              ? "Failed to update service record."
              : "Failed to add service record."
          )
        );
      }

      await loadRecords();

      setModalOpen(false);
      setEditingRecord(null);

      if (mileage > currentMileage) {
        setMileageUpdateError("");
        setPendingMileageUpdate(mileage);
      }
    } catch (saveError) {
      console.error("Service history save error:", saveError);

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save service record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmMileageUpdate = async () => {
    if (
      pendingMileageUpdate === null ||
      !vehicleId ||
      !resolvedOwnerId
    ) {
      return;
    }

    try {
      setMileageUpdateLoading(true);
      setMileageUpdateError("");

      const response = await fetch(
        `${apiUrl}/api/vin/vehicles/${vehicleId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner_id: resolvedOwnerId,
            current_mileage: pendingMileageUpdate,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await responseError(response, "Failed to update vehicle mileage.")
        );
      }

      onMileageUpdated?.(pendingMileageUpdate);
      setPendingMileageUpdate(null);
      setMileageUpdateError("");
    } catch (updateError) {
      console.error("Mileage update failed:", updateError);

      setMileageUpdateError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update vehicle mileage."
      );
    } finally {
      setMileageUpdateLoading(false);
    }
  };

  const handleDelete = async (record: ServiceRecord) => {
    if (!resolvedOwnerId) return;

    const confirmed = window.confirm(
      `Delete "${record.title}" from this vehicle's service history?`
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(
        `${apiUrl}/api/service-history/${record._id}?owner_id=${encodeURIComponent(
          resolvedOwnerId
        )}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          await responseError(response, "Failed to delete service record.")
        );
      }

      await loadRecords();
    } catch (deleteError) {
      console.error("Service history delete error:", deleteError);

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete service record."
      );
    }
  };

  if (!isActive) {
    return null;
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Service records
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {vehicleName}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Record completed maintenance and replaced parts.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366]"
          >
            <Plus size={16} />
            Add Service Record
          </button>
        </div>

        {error && !modalOpen && (
          <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={17} className="animate-spin" />
              Loading service history...
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <FileText size={28} className="mx-auto text-slate-300" />

            <p className="mt-3 font-semibold text-slate-800">
              No service records yet
            </p>

            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Add an oil change, inspection, tire rotation, battery replacement,
              or another completed service.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {records.map((record) => (
              <div
                key={record._id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#001F3F]">
                      {record.record_type === "part_replacement" ? (
                        <PackageCheck size={18} />
                      ) : (
                        <Wrench size={18} />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900">
                          {record.title}
                        </h4>

                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          {record.record_type === "part_replacement"
                            ? "Part replacement"
                            : "Maintenance"}
                        </span>
                      </div>

                      {record.part_name && (
                        <p className="mt-1 text-sm text-slate-600">
                          Part: <span className="font-medium">{record.part_name}</span>
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarDays size={14} />
                          {formatDate(record.service_date)}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <Gauge size={14} />
                          {record.mileage.toLocaleString()} miles
                        </span>

                        {record.cost !== null && record.cost !== undefined && (
                          <span className="inline-flex items-center gap-1.5">
                            <DollarSign size={14} />
                            {record.cost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        )}
                      </div>

                      {record.provider && (
                        <p className="mt-2 text-sm text-slate-500">
                          Completed by:{" "}
                          <span className="font-medium text-slate-700">
                            {record.provider}
                          </span>
                        </p>
                      )}

                      {record.notes && (
                        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                          {record.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(record)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-[#001F3F]"
                      aria-label="Edit service record"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(record)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete service record"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editingRecord
                    ? "Edit service record"
                    : "Record completed service"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">{vehicleName}</p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close service record form"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Record Type
                </label>

                <select
                  name="recordType"
                  value={form.recordType}
                  onChange={handleFormChange}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="part_replacement">Part Replacement</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Service / Task
                </label>

                <input
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleFormChange}
                  placeholder="e.g. Oil Change"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                  required
                />
              </div>

              {form.recordType === "part_replacement" && (
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Part Replaced
                  </label>

                  <input
                    name="partName"
                    type="text"
                    value={form.partName}
                    onChange={handleFormChange}
                    placeholder="e.g. Battery"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Service Date
                  </label>

                  <input
                    name="serviceDate"
                    type="date"
                    value={form.serviceDate}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Mileage
                  </label>

                  <input
                    name="mileage"
                    type="number"
                    min={0}
                    value={form.mileage}
                    onChange={handleFormChange}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Cost
                  </label>

                  <input
                    name="cost"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.cost}
                    onChange={handleFormChange}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Shop / Mechanic
                  </label>

                  <input
                    name="provider"
                    type="text"
                    value={form.provider}
                    onChange={handleFormChange}
                    placeholder="Optional / DIY"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Notes
                </label>

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows={3}
                  placeholder="Optional service details..."
                  className="mt-1 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#001F3F] focus:ring-2 focus:ring-[#001F3F]/10"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:opacity-50"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}

                  {saving
                    ? "Saving..."
                    : editingRecord
                      ? "Save Changes"
                      : "Add Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {pendingMileageUpdate !== null && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#001F3F]">
              <Gauge size={20} />
            </div>

            <h3 className="mt-5 text-xl font-bold text-slate-900">
              Update vehicle mileage?
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              You recorded this service at{" "}
              <span className="font-semibold text-slate-800">
                {pendingMileageUpdate.toLocaleString()} miles
              </span>
              , but {vehicleName} currently shows{" "}
              <span className="font-semibold text-slate-800">
                {currentMileage.toLocaleString()} miles
              </span>
              .
            </p>

            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
              <p className="text-sm leading-6 text-slate-600">
                Updating the odometer keeps your vehicle profile and future
                maintenance calculations current.
              </p>
            </div>

            {mileageUpdateError && (
              <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {mileageUpdateError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={mileageUpdateLoading}
                onClick={() => {
                  setPendingMileageUpdate(null);
                  setMileageUpdateError("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Keep {currentMileage.toLocaleString()}
              </button>

              <button
                type="button"
                disabled={mileageUpdateLoading}
                onClick={() => void handleConfirmMileageUpdate()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:opacity-50"
              >
                {mileageUpdateLoading && (
                  <Loader2 size={15} className="animate-spin" />
                )}

                {mileageUpdateLoading
                  ? "Updating..."
                  : `Update to ${pendingMileageUpdate.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
