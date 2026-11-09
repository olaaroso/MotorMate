"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Archive, Bell, CheckCheck, CheckCircle2, History, Inbox, X } from "lucide-react";

import { auth } from "@/lib/firebase";
import {
  type AppNotification,
  NOTIFICATIONS_UPDATED_EVENT,
  announceNotificationsUpdated,
  clearAllNotifications,
  clearNotification,
  fetchNotifications,
  getNotificationDestination,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export type NotificationsViewMode = "inbox" | "history";

type NotificationsViewProps = {
  initialView?: NotificationsViewMode;
  subtitle: string;
};

export default function NotificationsView({
  initialView = "inbox",
  subtitle,
}: NotificationsViewProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<NotificationsViewMode>(initialView);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"read-all" | "clear-all" | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const isHistory = view === "history";
  const unreadCount = notifications.filter((n) => !n.is_read && !n.cleared_at).length;
  const visibleCount = notifications.filter((n) => !n.cleared_at).length;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? "");
      if (!user) {
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const refresh = () => {
      fetchNotifications(userId, view === "history")
        .then((data) => {
          if (cancelled) return;
          setNotifications(data);
          setError("");
        })
        .catch((loadError) => {
          if (cancelled) return;
          console.error("Failed to fetch notifications:", loadError);
          setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    refresh();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    };
  }, [userId, view]);

  const switchView = (nextView: NotificationsViewMode) => {
    if (nextView === view) return;
    setLoading(true);
    setView(nextView);
  };

  const runAction = async (action: () => Promise<unknown>, failure: string) => {
    try {
      setError("");
      await action();
      announceNotificationsUpdated();
    } catch (actionError) {
      console.error(failure, actionError);
      setError(actionError instanceof Error ? actionError.message : failure);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    await runAction(
      () => markNotificationRead(notificationId, userId),
      "Failed to mark notification as read."
    );
  };

  const handleClear = async (notificationId: string) => {
    if (!userId || clearingId) return;
    setClearingId(notificationId);
    await runAction(
      () => clearNotification(notificationId, userId),
      "Failed to clear notification."
    );
    setClearingId(null);
  };

  const handleMarkAllRead = async () => {
    if (!userId || busyAction || unreadCount === 0) return;
    setBusyAction("read-all");
    await runAction(() => markAllNotificationsRead(userId), "Failed to mark all as read.");
    setBusyAction(null);
  };

  const handleClearAll = async () => {
    if (!userId || busyAction || visibleCount === 0) return;
    const confirmed = window.confirm(
      "Clear all notifications? They will still be available in Notification History."
    );
    if (!confirmed) return;

    setBusyAction("clear-all");
    await runAction(() => clearAllNotifications(userId), "Failed to clear notifications.");
    setBusyAction(null);
  };

  const handleOpen = async (alert: AppNotification) => {
    if (!alert.is_read) {
      await markAsRead(alert.id);
    }
    router.push(getNotificationDestination(alert));
  };

  return (
    <div className="mx-auto max-w-3xl p-6 sm:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#001F3F]">
            {isHistory ? "Notification History" : "Notifications"}
          </h1>
          <p className="mt-1 text-slate-500">
            {isHistory
              ? "Every notification you have received, including ones you cleared."
              : subtitle}
          </p>
          {!isHistory && unreadCount > 0 && (
            <p className="mt-2 text-sm font-medium text-blue-600">
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {!isHistory && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={Boolean(busyAction) || unreadCount === 0}
              className="flex items-center gap-2 rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCheck size={17} />
              {busyAction === "read-all" ? "Marking..." : "Mark all as read"}
            </button>
            <button
              type="button"
              onClick={() => void handleClearAll()}
              disabled={Boolean(busyAction) || visibleCount === 0}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Archive size={17} />
              {busyAction === "clear-all" ? "Clearing..." : "Clear all"}
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <TabButton
          active={!isHistory}
          icon={<Inbox size={16} />}
          label="Inbox"
          onClick={() => switchView("inbox")}
        />
        <TabButton
          active={isHistory}
          icon={<History size={16} />}
          label="History"
          onClick={() => switchView("history")}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-slate-500">Loading alerts...</div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-500">
          <Bell size={32} className="mb-4 text-slate-300" />
          <p>{isHistory ? "No notifications yet." : "You're all caught up!"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {notifications.map((alert) => {
            const highlighted = !alert.is_read && !alert.cleared_at;

            return (
              <div
                key={alert.id}
                className={`flex items-start justify-between gap-4 rounded-2xl border p-5 transition ${
                  highlighted
                    ? "border-blue-100 bg-blue-50 shadow-sm"
                    : "border-slate-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleOpen(alert)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {highlighted && <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                    <h3 className={`font-semibold ${highlighted ? "text-[#001F3F]" : "text-slate-700"}`}>
                      {alert.title}
                    </h3>
                    {alert.cleared_at && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Cleared
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-sm ${highlighted ? "text-slate-700" : "text-slate-500"}`}>
                    {alert.message}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {new Date(alert.created_at).toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs font-medium text-blue-600">View details</p>
                </button>

                {!isHistory && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!alert.is_read && (
                      <button
                        type="button"
                        onClick={() => void markAsRead(alert.id)}
                        className="flex items-center gap-1.5 rounded-lg text-xs font-medium text-blue-600 transition hover:text-blue-800"
                      >
                        <CheckCircle2 size={16} />
                        Mark as read
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleClear(alert.id)}
                      disabled={clearingId === alert.id}
                      className="flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-500 transition hover:text-red-600 disabled:opacity-50"
                    >
                      <X size={16} />
                      {clearingId === alert.id ? "Clearing..." : "Clear"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-[#001F3F] text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
