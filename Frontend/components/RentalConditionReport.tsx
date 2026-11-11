"use client";

import { useState } from "react";
import { Camera, ChevronDown, ChevronUp, ExternalLink, History, ShieldAlert } from "lucide-react";
import QRHandoffButton, { HandoffStage } from "@/components/QRHandoffButton";

export type ConditionEvidence = {
    photo_url?: string | null;
    photo_urls?: string[] | null;
    notes?: string | null;
    condition_notes?: string | null;
};

export type RentalConditionRecord = {
    id: string;
    tool_name: string;
    start_date: string;
    end_date: string;
    status: string;
    renter_name?: string;
    handoff_issue_open?: boolean;
    handoff_issue?: { reason?: string; reported_by?: string };
    pickup_owner_evidence?: ConditionEvidence;
    pickup_borrower_evidence?: ConditionEvidence;
    return_borrower_evidence?: ConditionEvidence;
    return_owner_evidence?: ConditionEvidence;
    pickup_owner_confirmed_at?: string;
    pickup_borrower_confirmed_at?: string;
    return_borrower_submitted_at?: string;
    return_owner_confirmed_at?: string;
};

type Stage = {
    title: string;
    stageKey: HandoffStage;
    evidence?: ConditionEvidence;
    submittedAt?: string;
    allowedRole: "owner" | "borrower";
};

function photos(evidence?: ConditionEvidence): string[] {
    if (!evidence) return [];
    const list = Array.isArray(evidence.photo_urls) ? evidence.photo_urls : [];
    return [...new Set([...list, ...(evidence.photo_url ? [evidence.photo_url] : [])].filter(Boolean))].slice(0, 3);
}

function EvidenceStage({
                           stage,
                           rentalId,
                           actorId,
                           userRole,
                           onUpdate,
                       }: {
    stage: Stage;
    rentalId: string;
    actorId?: string;
    userRole?: "owner" | "borrower";
    onUpdate?: () => void;
}) {
    const urls = photos(stage.evidence);
    const note = stage.evidence?.notes || stage.evidence?.condition_notes;
    const isMySlot = actorId && userRole === stage.allowedRole;
    const canUpload = Boolean(isMySlot && !stage.submittedAt && urls.length === 0);

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <h4 className="font-semibold text-slate-900">{stage.title}</h4>
                    <p className="mt-1 text-xs text-slate-500">
                        {stage.submittedAt ? new Date(stage.submittedAt).toLocaleString() : "Not submitted yet"}
                    </p>
                </div>
                {canUpload && actorId && (
                    <QRHandoffButton
                        rentalId={rentalId}
                        actorId={actorId}
                        stage={stage.stageKey}
                        label="Upload via QR"
                        onUploaded={() => {
                            if (onUpdate) onUpdate();
                        }}
                    />
                )}
            </div>

            {urls.length ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {urls.map((url, index) => (
                        <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-slate-50"
                            title="Open original condition photo"
                        >
                            <img
                                src={url}
                                alt={`${stage.title} condition photo ${index + 1}`}
                                className="h-full w-full object-contain"
                                loading="lazy"
                            />
                            <ExternalLink
                                size={14}
                                className="absolute right-2 top-2 rounded bg-white/90 p-0.5 text-slate-600 opacity-0 group-hover:opacity-100"
                            />
                        </a>
                    ))}
                </div>
            ) : (
                <div className="mt-3 flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed bg-slate-50 text-slate-400">
                    <Camera size={24} />
                    <p className="mt-2 text-xs">No photo submitted</p>
                </div>
            )}
            {note && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{note}</p>}
        </section>
    );
}

export default function RentalConditionReport({
                                                  rental,
                                                  actorId,
                                                  role,
                                                  onUpdate,
                                                  defaultOpen = false,
                                              }: {
    rental: RentalConditionRecord;
    actorId?: string;
    role?: "owner" | "borrower";
    onUpdate?: () => void;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    const before: Stage[] = [
        {
            title: "Owner's pickup photo",
            stageKey: "pickup_owner",
            evidence: rental.pickup_owner_evidence,
            submittedAt: rental.pickup_owner_confirmed_at,
            allowedRole: "owner",
        },
        {
            title: "Borrower's pickup photo",
            stageKey: "pickup_borrower",
            evidence: rental.pickup_borrower_evidence,
            submittedAt: rental.pickup_borrower_confirmed_at,
            allowedRole: "borrower",
        },
    ];

    const after: Stage[] = [
        {
            title: "Borrower's return photo",
            stageKey: "return_borrower",
            evidence: rental.return_borrower_evidence,
            submittedAt: rental.return_borrower_submitted_at,
            allowedRole: "borrower",
        },
        {
            title: "Owner's return inspection",
            stageKey: "return_owner",
            evidence: rental.return_owner_evidence,
            submittedAt: rental.return_owner_confirmed_at,
            allowedRole: "owner",
        },
    ];

    return (
        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                aria-expanded={open}
            >
        <span className="flex items-center gap-2 text-sm font-semibold text-[#001F3F]">
          <History size={17} /> View Condition Report
        </span>
                {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>

            {open && (
                <div className="border-t border-slate-200 p-4">
                    <p className="mb-4 text-xs text-slate-500">
                        Photos and notes are recorded per rental. Both the owner and borrower can review their submissions,
                        including after return. Submitted evidence cannot be edited through this report.
                    </p>

                    {rental.handoff_issue_open && (
                        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                            <ShieldAlert size={17} className="mt-0.5 shrink-0" />
                            <div>
                                <strong>Reported handoff issue</strong>
                                <p>{rental.handoff_issue?.reason || "An issue was reported."}</p>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                            <h3 className="mb-2 text-sm font-bold text-emerald-800">Rental Pickup Condition</h3>
                            <div className="space-y-3">
                                {before.map((stage) => (
                                    <EvidenceStage
                                        key={stage.title}
                                        stage={stage}
                                        rentalId={rental.id}
                                        actorId={actorId}
                                        userRole={role}
                                        onUpdate={onUpdate}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="mb-2 text-sm font-bold text-blue-800">Rental Return Condition</h3>
                            <div className="space-y-3">
                                {after.map((stage) => (
                                    <EvidenceStage
                                        key={stage.title}
                                        stage={stage}
                                        rentalId={rental.id}
                                        actorId={actorId}
                                        userRole={role}
                                        onUpdate={onUpdate}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-slate-500">
                        Photos can support a condition dispute but do not automatically establish responsibility or authorize a charge.
                    </p>
                </div>
            )}
        </section>
    );
}