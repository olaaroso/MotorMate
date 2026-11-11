"use client";

import { useState } from "react";
import { Camera, ChevronDown, ChevronUp, ExternalLink, History, ShieldAlert } from "lucide-react";

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

type Stage = { title: string; evidence?: ConditionEvidence; submittedAt?: string };

function photos(evidence?: ConditionEvidence): string[] {
  if (!evidence) return [];
  const list = Array.isArray(evidence.photo_urls) ? evidence.photo_urls : [];
  return [...new Set([...list, ...(evidence.photo_url ? [evidence.photo_url] : [])].filter(Boolean))].slice(0, 3);
}

function EvidenceStage({ stage }: { stage: Stage }) {
  const urls = photos(stage.evidence);
  const note = stage.evidence?.notes || stage.evidence?.condition_notes;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <h4 className="font-semibold text-slate-900">{stage.title}</h4>
      <p className="mt-1 text-xs text-slate-500">
        {stage.submittedAt ? new Date(stage.submittedAt).toLocaleString() : "Not submitted yet"}
      </p>
      {urls.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {urls.map((url, index) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer"
              className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-slate-50"
              title="Open original condition photo">
              <img src={url} alt={`${stage.title} condition photo ${index + 1}`}
                className="h-full w-full object-contain" loading="lazy" />
              <ExternalLink size={14} className="absolute right-2 top-2 rounded bg-white/90 p-0.5 text-slate-600 opacity-0 group-hover:opacity-100" />
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

export default function RentalConditionReport({ rental, defaultOpen = false }: {
  rental: RentalConditionRecord;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const before: Stage[] = [
    { title: "Owner · at pickup", evidence: rental.pickup_owner_evidence, submittedAt: rental.pickup_owner_confirmed_at },
    { title: "Borrower · on receipt", evidence: rental.pickup_borrower_evidence, submittedAt: rental.pickup_borrower_confirmed_at },
  ];
  const after: Stage[] = [
    { title: "Borrower · at return", evidence: rental.return_borrower_evidence, submittedAt: rental.return_borrower_submitted_at },
    { title: "Owner · after inspection", evidence: rental.return_owner_evidence, submittedAt: rental.return_owner_confirmed_at },
  ];
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen(value => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
        aria-expanded={open}>
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
              <div><strong>Reported handoff issue</strong><p>{rental.handoff_issue?.reason || "An issue was reported."}</p></div>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-emerald-800">Before · Pickup</h3>
              <div className="space-y-3">{before.map(stage => <EvidenceStage key={stage.title} stage={stage} />)}</div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-blue-800">After · Return</h3>
              <div className="space-y-3">{after.map(stage => <EvidenceStage key={stage.title} stage={stage} />)}</div>
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
