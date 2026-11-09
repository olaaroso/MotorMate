export type AppNotification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  cleared_at?: string | null;
  destination?: string;
};

export const NOTIFICATIONS_UPDATED_EVENT = "motormate:notifications-updated";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getNotificationDestination(alert: AppNotification): string {
  if (alert.destination) {
    return alert.destination;
  }

  if (
    alert.title === "New Rental Request!" ||
    (alert.title === "Rental Cancelled" &&
      alert.message.startsWith("The borrower cancelled")) ||
    alert.title === "Tool Pickup Confirmed" ||
    alert.title === "Tool Return Awaiting Confirmation"
  ) {
    return "/myTools";
  }

  return "/rentals";
}

export function announceNotificationsUpdated() {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

async function request<T>(path: string, init: RequestInit | undefined, failure: string): Promise<T> {
  const response = await fetch(`${API_URL}/api/notifications${path}`, {
    cache: "no-store",
    ...init,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || failure);
  }

  return data as T;
}

export function fetchNotifications(userId: string, includeCleared = false) {
  const query = includeCleared ? "?include_cleared=true" : "";
  return request<AppNotification[]>(
    `/${encodeURIComponent(userId)}${query}`,
    undefined,
    "Failed to load notifications."
  );
}

export function markNotificationRead(notificationId: string, userId: string) {
  return request<AppNotification>(
    `/${encodeURIComponent(notificationId)}/read?user_id=${encodeURIComponent(userId)}`,
    { method: "PATCH" },
    "Failed to mark notification as read."
  );
}

export function markAllNotificationsRead(userId: string) {
  return request<{ modified_count: number }>(
    `/user/${encodeURIComponent(userId)}/read-all`,
    { method: "PATCH" },
    "Failed to mark all notifications as read."
  );
}

export function clearNotification(notificationId: string, userId: string) {
  return request<AppNotification>(
    `/${encodeURIComponent(notificationId)}/clear?user_id=${encodeURIComponent(userId)}`,
    { method: "PATCH" },
    "Failed to clear notification."
  );
}

export function clearAllNotifications(userId: string) {
  return request<{ modified_count: number }>(
    `/user/${encodeURIComponent(userId)}/clear-all`,
    { method: "PATCH" },
    "Failed to clear notifications."
  );
}
