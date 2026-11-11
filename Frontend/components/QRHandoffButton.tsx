import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Loader2, QrCode, Smartphone, X } from "lucide-react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export type HandoffStage =
    | "pickup_owner"
    | "pickup_borrower"
    | "return_borrower"
    | "return_owner";

type QRHandoffButtonProps = {
    rentalId: string;
    actorId: string;
    stage: HandoffStage;
    label?: string;
    onUploaded: (evidence: { photo_url: string; notes?: string }) => void;
};

export default function QRHandoffButton({
                                            rentalId,
                                            actorId,
                                            stage,
                                            label = "Upload via QR",
                                            onUploaded,
                                        }: QRHandoffButtonProps) {
    const [open, setOpen] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [completed, setCompleted] = useState(false);

    const startSession = async () => {
        setOpen(true);
        setLoading(true);
        setError("");
        setCompleted(false);
        setToken(null);

        try {
            const res = await fetch(`${apiUrl}/api/diy/rental-requests/${rentalId}/qr-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actor_id: actorId, stage }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.detail || "Could not create QR session.");
            }
            setToken(data.token);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create QR session.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!open || !token || completed) return;

        const timer = window.setInterval(async () => {
            try {
                const res = await fetch(`${apiUrl}/api/diy/qr-session/${token}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data.status === "completed" && data.photo_url) {
                    setCompleted(true);
                    onUploaded({ photo_url: data.photo_url, notes: data.notes || "" });
                    setTimeout(() => setOpen(false), 1200);
                }
            } catch {
                // Ignore poll retries
            }
        }, 2500);

        return () => window.clearInterval(timer);
    }, [open, token, completed, onUploaded]);

    // Derive origin from env or the browser window
    const getBaseUrl = () => {
        if (process.env.NEXT_PUBLIC_APP_URL) {
            return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
        }
        if (typeof window !== "undefined") {
            return window.location.origin;
        }
        return "http://localhost:3000";
    };

    const mobileUrl = token ? `${getBaseUrl()}/handoff-upload/${token}` : "";

    return (
        <>
            <button
                type="button"
                onClick={() => void startSession()}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
            >
                <QrCode size={14} />
                {label}
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
                    <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-2.5 text-[#001F3F]">
                            <Smartphone size={20} />
                            <h3 className="text-lg font-bold">Scan with Your Phone</h3>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Point your phone camera at this QR code to snap and upload the condition photo.
                        </p>

                        <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6">
                            {loading ? (
                                <div className="flex h-44 items-center justify-center text-sm text-slate-500">
                                    <Loader2 size={20} className="mr-2 animate-spin" />
                                    Generating QR code...
                                </div>
                            ) : error ? (
                                <div className="text-center">
                                    <p className="text-sm text-red-600">{error}</p>
                                    <button
                                        type="button"
                                        onClick={() => void startSession()}
                                        className="mt-3 rounded-lg bg-[#001F3F] px-3 py-1.5 text-xs font-semibold text-white"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            ) : completed ? (
                                <div className="flex h-44 flex-col items-center justify-center text-emerald-600">
                                    <CheckCircle2 size={42} />
                                    <p className="mt-2 text-sm font-semibold">Photo received! Updating report...</p>
                                </div>
                            ) : (
                                token && (
                                    <>
                                        <div className="rounded-xl bg-white p-3 shadow-xs ring-1 ring-slate-200">
                                            <QRCodeSVG value={mobileUrl} size={180} />
                                        </div>
                                        <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                            <Loader2 size={13} className="animate-spin text-blue-600" />
                                            Waiting for photo from your phone...
                                        </p>
                                    </>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}