
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
    if (alert.destination === "/myTools" ||
        alert.destination === "/rentals") {
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

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const unreadCount = notifications.filter(
        (notification) => !notification.is_read
    ).length;

    const fetchNotifications = useCallback(async (uid: string) => {
        try {
            const res = await fetch(
                `${API_URL}/api/notifications/${encodeURIComponent(uid)}`,
                { cache: "no-store" }
            );

            if (!res.ok) {
                throw new Error("Unable to fetch notifications");
            }

            const data: Notification[] = await res.json();
            setNotifications(data);
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                void fetchNotifications(user.uid);
            } else {
                setNotifications([]);
            }
        });

        return () => unsubscribe();
    }, [fetchNotifications]);

    useEffect(() => {
        const refresh = () => {
            const uid = auth.currentUser?.uid;
            if (uid) {
                void fetchNotifications(uid);
            }
        };

        window.addEventListener(
            "motormate:notifications-updated",
            refresh
        );
        window.addEventListener("focus", refresh);

        return () => {
            window.removeEventListener(
                "motormate:notifications-updated",
                refresh
            );
            window.removeEventListener("focus", refresh);
        };
    }, [fetchNotifications]);

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

    const handleNotificationClick = async (alert: Notification) => {
        if (!alert.is_read) {
            try {
                const res = await fetch(
                    `${API_URL}/api/notifications/${alert.id}/read`,
                    { method: "PATCH" }
                );

                if (res.ok) {
                    setNotifications((prev) =>
                        prev.map((n) =>
                            n.id === alert.id
                                ? { ...n, is_read: true }
                                : n
                        )
                    );
                }
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

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => {
                    if (!isOpen && auth.currentUser) {
                        void fetchNotifications(auth.currentUser.uid);
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
                                <button
                                    key={alert.id}
                                    onClick={() =>
                                        void handleNotificationClick(alert)
                                    }
                                    className={`flex flex-col items-start rounded-lg p-3 text-left transition hover:bg-slate-100 ${
                                        !alert.is_read
                                            ? "bg-blue-50/60"
                                            : "bg-white"
                                    }`}
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
                            ))
                        )}
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                        <Link
                            href="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="block w-full rounded-lg py-2 text-center text-sm font-medium text-blue-600 transition hover:bg-slate-50 hover:text-blue-800"
                        >
                            View all notifications
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
