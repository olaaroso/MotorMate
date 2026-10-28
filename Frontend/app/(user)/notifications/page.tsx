
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Bell, CheckCircle2, CheckCheck } from "lucide-react";

type Notification = {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    destination?: string;
};

const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function getNotificationDestination(alert: Notification): string {
    if (
        alert.destination === "/myTools" ||
        alert.destination === "/rentals"
    ) {
        return alert.destination;
    }

    if (
        alert.title === "New Rental Request!" ||
        (
            alert.title === "Rental Cancelled" &&
            alert.message.startsWith("The borrower cancelled")
        ) ||
        alert.title === "Tool Pickup Confirmed" ||
        alert.title === "Tool Return Awaiting Confirmation"
    ) {
        return "/myTools";
    }

    return "/rentals";
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);

    const router = useRouter();

    const unreadCount = notifications.filter(
        (n) => !n.is_read
    ).length;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                await fetchNotifications(user.uid);
            } else {
                setNotifications([]);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchNotifications = async (uid: string) => {
        try {
            const res = await fetch(
                `${API_URL}/api/notifications/${encodeURIComponent(uid)}`,
                { cache: "no-store" }
            );

            if (!res.ok) {
                throw new Error("Failed to load notifications");
            }

            const data: Notification[] = await res.json();
            setNotifications(data);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const notifyBell = () => {
        window.dispatchEvent(
            new Event("motormate:notifications-updated")
        );
    };

    const markAsRead = async (notificationId: string) => {
        try {
            const res = await fetch(
                `${API_URL}/api/notifications/${notificationId}/read`,
                { method: "PATCH" }
            );

            if (!res.ok) {
                throw new Error("Failed to mark notification as read");
            }

            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId
                        ? { ...n, is_read: true }
                        : n
                )
            );

            notifyBell();
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const markAllAsRead = async () => {
        const user = auth.currentUser;

        if (!user || markingAll || unreadCount === 0) {
            return;
        }

        try {
            setMarkingAll(true);

            const res = await fetch(
                `${API_URL}/api/notifications/user/${encodeURIComponent(user.uid)}/read-all`,
                { method: "PATCH" }
            );

            if (!res.ok) {
                throw new Error("Failed to mark all as read");
            }

            setNotifications((prev) =>
                prev.map((n) => ({
                    ...n,
                    is_read: true,
                }))
            );

            notifyBell();
        } catch (error) {
            console.error("Failed to mark all as read:", error);
        } finally {
            setMarkingAll(false);
        }
    };

    const handleNotificationClick = async (alert: Notification) => {
        if (!alert.is_read) {
            await markAsRead(alert.id);
        }

        router.push(getNotificationDestination(alert));
    };

    if (loading) {
        return (
            <div className="p-8 text-slate-500">
                Loading alerts...
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl p-6 sm:p-10">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#001F3F]">
                        Notifications
                    </h1>

                    <p className="mt-1 text-slate-500">
                        Stay updated on your tool rentals and garage alerts.
                    </p>

                    {unreadCount > 0 && (
                        <p className="mt-2 text-sm font-medium text-blue-600">
                            {unreadCount} unread notification
                            {unreadCount !== 1 ? "s" : ""}
                        </p>
                    )}
                </div>

                <button
                    onClick={() => void markAllAsRead()}
                    disabled={markingAll || unreadCount === 0}
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-[#001F3F] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <CheckCheck size={17} />
                    {markingAll
                        ? "Marking..."
                        : "Mark all as read"}
                </button>
            </div>

            <div className="flex flex-col gap-4">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-500">
                        <Bell
                            size={32}
                            className="mb-4 text-slate-300"
                        />
                        <p>You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((alert) => (
                        <div
                            key={alert.id}
                            className={`flex items-start justify-between gap-4 rounded-2xl border p-5 transition ${
                                alert.is_read
                                    ? "border-slate-200 bg-white"
                                    : "border-blue-100 bg-blue-50 shadow-sm"
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    void handleNotificationClick(alert)
                                }
                                className="min-w-0 flex-1 text-left"
                            >
                                <div className="flex items-center gap-2">
                                    {!alert.is_read && (
                                        <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                                    )}

                                    <h3
                                        className={`font-semibold ${
                                            alert.is_read
                                                ? "text-slate-700"
                                                : "text-[#001F3F]"
                                        }`}
                                    >
                                        {alert.title}
                                    </h3>
                                </div>

                                <p
                                    className={`mt-1 text-sm ${
                                        alert.is_read
                                            ? "text-slate-500"
                                            : "text-slate-700"
                                    }`}
                                >
                                    {alert.message}
                                </p>

                                <p className="mt-2 text-xs text-slate-400">
                                    {new Date(
                                        alert.created_at
                                    ).toLocaleString()}
                                </p>

                                <p className="mt-2 text-xs font-medium text-blue-600">
                                    View details
                                </p>
                            </button>

                            {!alert.is_read && (
                                <button
                                    onClick={() =>
                                        void markAsRead(alert.id)
                                    }
                                    className="flex shrink-0 items-center gap-1.5 rounded-lg text-xs font-medium text-blue-600 transition hover:text-blue-800"
                                >
                                    <CheckCircle2 size={16} />
                                    Mark as read
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
