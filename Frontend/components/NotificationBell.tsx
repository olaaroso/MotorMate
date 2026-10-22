"use client";

import { useEffect, useState, useRef } from "react";
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
};

export default function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const res = await fetch(`http://127.0.0.1:8000/api/notifications/${user.uid}`);
                    if (res.ok) {
                        const data: Notification[] = await res.json();
                        setNotifications(data);
                    }
                } catch (error) {
                    console.error("Failed to fetch notifications:", error);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNotificationClick = async (alert: Notification) => {
        if (!alert.is_read) {
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/notifications/${alert.id}/read`, {
                    method: "PATCH",
                });

                if (res.ok) {
                    setNotifications((prev) =>
                        prev.map((n) => (n.id === alert.id ? { ...n, is_read: true } : n))
                    );
                }
            } catch (error) {
                console.error("Failed to mark as read", error);
            }
        }

        setIsOpen(false);
        router.push("/rentals");
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* 1. THE BELL BUTTON */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notifications"
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                    isOpen ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
            >
                <Bell size={20} className="shrink-0" />

                {unreadCount > 0 && (
                    <div className="absolute right-2.5 top-2.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 shadow-sm ring-2 ring-[#001F3F]" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 z-50">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[#001F3F]">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {unreadCount} new
              </span>
                        )}
                    </div>

                    {/* 3. ALERT PREVIEWS (Shows max 5) */}
                    <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <p className="py-4 text-center text-sm text-slate-500">No recent alerts.</p>
                        ) : (
                            notifications.slice(0, 5).map((alert) => (
                                <button
                                    key={alert.id}
                                    onClick={() => handleNotificationClick(alert)}
                                    className={`flex flex-col items-start rounded-lg p-3 text-left transition hover:bg-slate-100 ${
                                        !alert.is_read ? "bg-blue-50/60" : "bg-white"
                                    }`}
                                >
                                    <div className="flex w-full items-center justify-between gap-2">
                    <span className={`text-sm ${!alert.is_read ? "text-[#001F3F] font-semibold" : "text-slate-600 font-medium"}`}>
                      {alert.title}
                    </span>
                                        {!alert.is_read && <div className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                                    </div>
                                    <span className={`mt-1 line-clamp-2 text-xs leading-relaxed ${!alert.is_read ? "text-slate-700" : "text-slate-500"}`}>
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