export type MessagingView = "mechanic" | "customer";

export type RequestMessage = {
  id: string;
  sender_role: MessagingView;
  body: string;
  kind: "text";
  created_at: string;
};

export type RequestThread = {
  service_request_id: string;
  status: string;
  can_send: boolean;
  unread_count: number;
  messages: RequestMessage[];
};

export const MAX_MESSAGE_LENGTH = 1000;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export class MessagesRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function isServiceRequestId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{24}$/.test(value);
}

function threadPath(requestId: string, suffix = "") {
  return `${API_URL}/api/service-requests/${encodeURIComponent(requestId)}/messages${suffix}`;
}

function actorQuery(actorId: string, view: MessagingView) {
  return new URLSearchParams({ actor_id: actorId, view }).toString();
}

async function request<T>(url: string, init: RequestInit | undefined, failure: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = typeof data.detail === "string" ? data.detail : failure;
    throw new MessagesRequestError(detail, response.status);
  }

  return data as T;
}

export function fetchRequestThread(requestId: string, actorId: string, view: MessagingView) {
  return request<RequestThread>(
    `${threadPath(requestId)}?${actorQuery(actorId, view)}`,
    undefined,
    "Failed to load messages."
  );
}

export async function sendRequestMessage(
  requestId: string,
  actorId: string,
  view: MessagingView,
  body: string
) {
  const data = await request<{ sent_message: RequestMessage }>(
    threadPath(requestId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor_id: actorId, view, body }),
    },
    "Failed to send message."
  );
  return data.sent_message;
}

export function markRequestThreadRead(requestId: string, actorId: string, view: MessagingView) {
  return request<{ unread_count: number }>(
    `${threadPath(requestId, "/read")}?${actorQuery(actorId, view)}`,
    { method: "PATCH" },
    "Failed to mark messages as read."
  );
}
