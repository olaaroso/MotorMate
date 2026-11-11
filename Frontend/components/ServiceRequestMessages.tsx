"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, MessageSquare, RefreshCw, Send } from "lucide-react";

import {
  MAX_MESSAGE_LENGTH,
  MessagesRequestError,
  type MessagingView,
  type RequestThread,
  fetchRequestThread,
  markRequestThreadRead,
  sendRequestMessage,
} from "@/lib/messages";
import { announceNotificationsUpdated } from "@/lib/notifications";

const POLL_INTERVAL_MS = 10_000;

type ServiceRequestMessagesProps = {
  requestId: string;
  actorId: string;
  view: MessagingView;
  counterpartName: string;
  requestStatus: string;
  open: boolean;
  onToggle: () => void;
  unreadCount?: number;
  onRead?: () => void;
};

export default function ServiceRequestMessages({
                                                 requestId,
                                                 actorId,
                                                 view,
                                                 counterpartName,
                                                 requestStatus,
                                                 open,
                                                 onToggle,
                                                 unreadCount = 0,
                                                 onRead,
                                               }: ServiceRequestMessagesProps) {
  const hasUnread = unreadCount > 0 && !open;
  const headerText = hasUnread
      ? `${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"} from ${counterpartName}`
      : `Messages with ${counterpartName}`;

  return (
      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
              className={`flex items-center gap-2 text-sm font-semibold ${
                  hasUnread ? "text-blue-700" : "text-slate-700"
              }`}
          >
            <MessageSquare size={15} className="text-blue-600" />
            {headerText}
            {hasUnread && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {unreadCount} new
            </span>
            )}
          </p>
          <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              aria-label={hasUnread ? `Open ${headerText}` : undefined}
              className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            {open ? "Hide messages" : "Open messages"}
          </button>
        </div>

        {open && actorId && (
            <MessageThread
                key={requestId}
                requestId={requestId}
                actorId={actorId}
                view={view}
                counterpartName={counterpartName}
                requestStatus={requestStatus}
                onRead={onRead}
            />
        )}
      </div>
  );
}

function readOnlyMessage(status: string) {
  if (status === "declined") return "This request was declined. Messaging is now read-only.";
  if (status === "completed") return "This service is completed. Messaging is now read-only.";
  if (status === "cancelled") return "This appointment was cancelled. Messaging is now read-only.";
  return "Messaging is read-only for this request.";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function MessageThread({
                         requestId,
                         actorId,
                         view,
                         counterpartName,
                         requestStatus,
                         onRead,
                       }: Omit<ServiceRequestMessagesProps, "open" | "onToggle" | "unreadCount">) {
  const [thread, setThread] = useState<RequestThread | null>(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const mounted = useRef(false);
  const loadInFlight = useRef(false);
  const sendVersion = useRef(0);
  const lastRequestStatus = useRef(requestStatus);
  const listRef = useRef<HTMLDivElement>(null);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;

  const loadThread = useCallback(
      (markAsRead: boolean) => {
        if (loadInFlight.current) return;
        loadInFlight.current = true;
        const version = sendVersion.current;

        fetchRequestThread(requestId, actorId, view)
            .then(async (next) => {
              if (!mounted.current) return;
              if (version === sendVersion.current) setThread(next);
              setLoadError("");

              if (markAsRead || next.unread_count > 0) {
                await markRequestThreadRead(requestId, actorId, view);
                onReadRef.current?.();
                announceNotificationsUpdated();
              }
            })
            .catch((error) => {
              if (mounted.current) setLoadError(errorMessage(error, "Failed to load messages."));
            })
            .finally(() => {
              loadInFlight.current = false;
            });
      },
      [requestId, actorId, view]
  );

  useEffect(() => {
    mounted.current = true;
    loadThread(true);
    return () => {
      mounted.current = false;
    };
  }, [loadThread]);

  useEffect(() => {
    if (lastRequestStatus.current === requestStatus) return;
    lastRequestStatus.current = requestStatus;
    loadThread(false);
  }, [requestStatus, loadThread]);

  const canSend = thread?.can_send ?? false;

  useEffect(() => {
    if (!canSend) return;

    const poll = () => {
      if (document.visibilityState === "visible") loadThread(false);
    };
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [canSend, loadThread]);

  const messageCount = thread?.messages.length ?? 0;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messageCount]);

  const trimmedDraft = draft.trim();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmedDraft || trimmedDraft.length > MAX_MESSAGE_LENGTH || sending) return;

    setSending(true);
    setSendError("");

    try {
      const sent = await sendRequestMessage(requestId, actorId, view, trimmedDraft);
      sendVersion.current += 1;
      if (!mounted.current) return;

      setThread((previous) =>
          previous && !previous.messages.some((message) => message.id === sent.id)
              ? { ...previous, messages: [...previous.messages, sent] }
              : previous
      );
      setDraft("");
      announceNotificationsUpdated();
    } catch (error) {
      if (!mounted.current) return;
      setSendError(errorMessage(error, "Failed to send message."));
      if (error instanceof MessagesRequestError && error.status === 409) {
        loadThread(false);
      }
    } finally {
      if (mounted.current) setSending(false);
    }
  };

  if (!thread) {
    return (
        <div className="mt-3 rounded-lg bg-white p-4 text-sm">
          {loadError ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-red-700">{loadError}</p>
                <button
                    type="button"
                    onClick={() => loadThread(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCw size={13} />
                  Retry
                </button>
              </div>
          ) : (
              <p className="flex items-center gap-2 text-slate-500">
                <Loader2 size={15} className="animate-spin" />
                Loading messages...
              </p>
          )}
        </div>
    );
  }

  return (
      <div className="mt-3 space-y-3">
        <div
            ref={listRef}
            className="max-h-80 space-y-3 overflow-y-auto rounded-lg bg-white p-3"
            aria-live="polite"
        >
          {thread.messages.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                {thread.can_send
                    ? "No messages yet. Send a message to start the conversation."
                    : "No messages were sent for this request."}
              </p>
          ) : (
              thread.messages.map((message) => {
                const mine = message.sender_role === view;

                return (
                    <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                              mine
                                  ? "rounded-br-md bg-[#001F3F] text-white"
                                  : "rounded-bl-md bg-slate-100 text-slate-800"
                          }`}
                      >
                        <p className="whitespace-pre-wrap break-words leading-6">{message.body}</p>
                        <p className={`mt-1 text-[11px] ${mine ? "text-white/60" : "text-slate-500"}`}>
                          {mine ? "You" : counterpartName} · {formatTimestamp(message.created_at)}
                        </p>
                      </div>
                    </div>
                );
              })
          )}
        </div>

        {loadError && <p className="text-xs text-red-700">{loadError}</p>}

        {thread.can_send ? (
            <form onSubmit={(event) => void submit(event)} className="space-y-2">
              <label htmlFor={`message-${requestId}`} className="sr-only">
                Message {counterpartName}
              </label>
              <textarea
                  id={`message-${requestId}`}
                  value={draft}
                  maxLength={MAX_MESSAGE_LENGTH}
                  rows={3}
                  disabled={sending}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setSendError("");
                  }}
                  placeholder={`Message ${counterpartName}`}
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] disabled:bg-slate-50"
              />
              <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-slate-400">
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </span>
                <button
                    type="submit"
                    disabled={sending || !trimmedDraft}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#001F3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#003366] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Send
                </button>
              </div>
              {sendError && <p className="text-sm text-red-700">{sendError}</p>}
            </form>
        ) : (
            <div className="space-y-2">
              {sendError && <p className="text-sm text-red-700">{sendError}</p>}
              <p className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-600">
                <Lock size={14} className="shrink-0 text-slate-400" />
                {readOnlyMessage(thread.status)}
              </p>
            </div>
        )}
      </div>
  );
}