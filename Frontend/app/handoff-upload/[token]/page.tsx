"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, CheckCircle2, Loader2, UploadCloud } from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
    pickup_owner: "Owner's Pickup Photo",
    pickup_borrower: "Borrower's Pickup Photo",
    return_borrower: "Borrower's Return Photo",
    return_owner: "Owner's Return Inspection",
};

function getApiBase() {
    if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
    if (typeof window !== "undefined") {
        return `http://${window.location.hostname}:8000`;
    }
    return "http://127.0.0.1:8000";
}

function compressImageToDataUrl(file: File, maxWidth = 1200): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, maxWidth / img.width);
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("Canvas unavailable"));
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.82));
            };
            img.onerror = () => reject(new Error("Invalid image file"));
            img.src = reader.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

export default function MobileHandoffUploadPage() {
    const params = useParams<{ token: string }>();
    const token = params?.token;

    const [session, setSession] = useState<{
        tool_name: string;
        stage: string;
        status: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [previewUrl, setPreviewUrl] = useState("");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!token) return;
        fetch(`${getApiBase()}/api/diy/qr-session/${token}`)
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.detail || "Invalid or expired QR link.");
                setSession(data);
                if (data.status === "completed") setDone(true);
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Failed to load session."))
            .finally(() => setLoading(false));
    }, [token]);

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setError("");
        try {
            const compressed = await compressImageToDataUrl(file);
            setPreviewUrl(compressed);
        } catch {
            setError("Could not process that photo. Please try another.");
        }
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!previewUrl || !token || submitting) return;

        setSubmitting(true);
        setError("");

        try {
            const res = await fetch(`${getApiBase()}/api/diy/qr-session/${token}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    photo_url: previewUrl,
                    condition_notes: notes.trim() || undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || "Upload failed.");
            setDone(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to upload photo.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-5">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    MotorMate ToolDrop
                </p>
                <h1 className="mt-1 text-xl font-bold text-slate-900">
                    {session ? STAGE_LABELS[session.stage] || "Condition Photo" : "Condition Photo Upload"}
                </h1>
                {session?.tool_name && (
                    <p className="mt-0.5 text-sm text-slate-500">Tool: {session.tool_name}</p>
                )}

                {loading ? (
                    <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                        <Loader2 size={20} className="mr-2 animate-spin" />
                        Connecting to session...
                    </div>
                ) : done ? (
                    <div className="mt-6 flex flex-col items-center rounded-xl bg-emerald-50 p-6 text-center text-emerald-800">
                        <CheckCircle2 size={44} className="text-emerald-600" />
                        <h2 className="mt-3 text-base font-bold">Photo Uploaded!</h2>
                        <p className="mt-1 text-xs text-emerald-700">
                            Your Condition Report on your computer has been updated automatically. You can close this tab.
                        </p>
                    </div>
                ) : error && !session ? (
                    <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
                ) : (
                    <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-6 text-center transition hover:bg-blue-50">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Condition preview"
                                    className="max-h-56 rounded-lg object-contain"
                                />
                            ) : (
                                <>
                                    <Camera size={32} className="text-blue-600" />
                                    <span className="mt-2 text-sm font-semibold text-[#001F3F]">
                    Tap to Take or Choose a Photo
                  </span>
                                    <span className="mt-1 text-xs text-slate-500">
                    Opens your phone camera directly
                  </span>
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => void handleFileChange(e)}
                                className="hidden"
                            />
                        </label>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700">
                                Condition Notes (Optional)
                            </label>
                            <textarea
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Any scratches, wear, or handoff notes..."
                                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#001F3F]"
                            />
                        </div>

                        {error && <p className="text-xs text-red-600">{error}</p>}

                        <button
                            type="submit"
                            disabled={!previewUrl || submitting}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#001F3F] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:opacity-50"
                        >
                            {submitting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <UploadCloud size={16} />
                            )}
                            {submitting ? "Uploading..." : "Submit Condition Photo"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}