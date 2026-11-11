
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
    type AppNotification,
    NOTIFICATIONS_UPDATED_EVENT,
    announceNotificationsUpdated,
    clearNotification,
    fetchNotifications as requestNotifications,
    getNotificationDestination,
    markNotificationRead,
} from "@/lib/notifications";
import { useVisibleInterval } from "@/lib/useVisibleInterval";

const NOTIFICATION_POLL_INTERVAL_MS = 30_000;

type NotificationBellProps = {
    notificationsHref?: string;
};

export default function NotificationBell({
    notificationsHref = "/notifications",
}: NotificationBellProps) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const unreadCount = notifications.filter(
        (notification) => !notification.is_read
    ).length;

    const fetchInFlight = useRef(false);
    const fetchQueued = useRef(false);
    const failureLogged = useRef(false);

    // Background refreshes (poll, focus) are dropped while one is in flight;
    // forced ones (sign-in, notification changes, opening the bell) run once
    // more afterwards so they never show a list fetched before the change.
    const refreshNotifications = useCallback((force = false) => {
        if (!auth.currentUser) return;
        if (fetchInFlight.current) {
            if (force) fetchQueued.current = true;
            return;
        }

        const run = () => {
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            fetchInFlight.current = true;
            requestNotifications(uid)
                .then((next) => {
                    failureLogged.current = false;
                    if (auth.currentUser?.uid === uid) setNotifications(next);
                })
                .catch((error) => {
                    // Log once per outage instead of on every poll.
                    if (!failureLogged.current) {
                        failureLogged.current = true;
                        console.error("Failed to fetch notifications:", error);
                    }
                })
                .finally(() => {
                    fetchInFlight.current = false;
                    if (fetchQueued.current) {
                        fetchQueued.current = false;
                        run();
                    }
                });
        };

        run();
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                refreshNotifications(true);
            } else {
                setNotifications([]);
            }
        });

        return () => unsubscribe();
    }, [refreshNotifications]);

    useEffect(() => {
        const refreshAfterChange = () => refreshNotifications(true);
        const refreshInBackground = () => refreshNotifications();

        window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshAfterChange);
        window.addEventListener("focus", refreshInBackground);

        return () => {
            window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshAfterChange);
            window.removeEventListener("focus", refreshInBackground);
        };
    }, [refreshNotifications]);

    useVisibleInterval(refreshNotifications, NOTIFICATION_POLL_INTERVAL_MS);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    const handleNotificationClick = async (alert: AppNotification) => {
        const uid = auth.currentUser?.uid;

        if (!alert.is_read && uid) {
            try {
                await markNotificationRead(alert.id, uid);
                setNotifications((prev) =>
                    prev.map((n) =>
                        n.id === alert.id
                            ? { ...n, is_read: true }
                            : n
                    )
                );
                announceNotificationsUpdated();
            } catch (error) {
                console.error(
                    "Failed to mark notification as read:",
                    error
                );
            }
        }

        setIsOpen(false);

        router.push(getNotificationDestination(alert));
    };

    const handleClear = async (alert: AppNotification) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        try {
            await clearNotification(alert.id, uid);
            setNotifications((prev) =>
                prev.filter((n) => n.id !== alert.id)
            );
            announceNotificationsUpdated();
        } catch (error) {
            console.error("Failed to clear notification:", error);
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => {
                    if (!isOpen) {
                        refreshNotifications(true);
                    }
                    setIsOpen(!isOpen);
                }}
                aria-label="Notifications"
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                    isOpen
                        ? "bg-white/10 text-white"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
            >
                <Bell size={20} className="shrink-0" />

                {unreadCount > 0 && (
                    <div className="absolute right-2.5 top-2.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 shadow-sm ring-2 ring-[#001F3F]" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[#001F3F]">
                            Notifications
                        </h3>

                        {unreadCount > 0 && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                {unreadCount} new
                            </span>
                        )}
                    </div>

                    <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="py-4 text-center text-sm text-slate-500">
                                No recent alerts.
                            </p>
                        ) : (
                            notifications.slice(0, 5).map((alert) => (
                                <div
                                    key={alert.id}
                                    className={`group relative rounded-lg transition hover:bg-slate-100 ${
                                        !alert.is_read
                                            ? "bg-blue-50/60"
                                            : "bg-white"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleNotificationClick(alert)
                                        }
                                        className="flex w-full flex-col items-start p-3 pr-9 text-left"
                                    >
                                        <div className="flex w-full items-center justify-between gap-2">
                                            <span
                                                className={`text-sm ${
                                                    !alert.is_read
                                                        ? "font-semibold text-[#001F3F]"
                                                        : "font-medium text-slate-600"
                                                }`}
                                            >
                                                {alert.title}
                                            </span>

                                            {!alert.is_read && (
                                                <div className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                                            )}
                                        </div>

                                        <span
                                            className={`mt-1 line-clamp-2 text-xs leading-relaxed ${
                                                !alert.is_read
                                                    ? "text-slate-700"
                                                    : "text-slate-500"
                                            }`}
                                        >
                                            {alert.message}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleClear(alert)}
                                        aria-label={`Clear notification: ${alert.title}`}
                                        title="Clear"
                                        className="absolute right-2 top-2.5 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-white hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                        <Link
                            href={notificationsHref}
                            onClick={() => setIsOpen(false)}
                            className="flex-1 rounded-lg py-2 text-center text-sm font-medium text-blue-600 transition hover:bg-slate-50 hover:text-blue-800"
                        >
                            View all
                        </Link>
                        <Link
                            href={`${notificationsHref}?view=history`}
                            onClick={() => setIsOpen(false)}
                            className="flex-1 rounded-lg py-2 text-center text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                            History
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
