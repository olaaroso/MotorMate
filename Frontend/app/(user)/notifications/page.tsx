"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Bell, CheckCircle2 } from "lucide-react";

type Notification = {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                await fetchNotifications(user.uid);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchNotifications = async (uid: string) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/notifications/${uid}`);
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (notificationId: string) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/notifications/${notificationId}/read`, {
                method: "PATCH",
            });

            if (res.ok) {
                setNotifications((prev) =>
                    prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
                );
            }
        } catch (error) {
            console.error("Failed to mark as read", error);
        }
    };

    if (loading) {
        return <div className="p-8 text-slate-500">Loading alerts...</div>;
    }

    return (
        <div className="mx-auto max-w-3xl p-6 sm:p-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-[#001F3F]">Notifications</h1>
                <p className="mt-1 text-slate-500">Stay updated on your tool rentals and garage alerts.</p>
            </div>

            <div className="flex flex-col gap-4">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-500">
                        <Bell size={32} className="mb-4 text-slate-300" />
                        <p>You're all caught up!</p>
                    </div>
                ) : (
                    notifications.map((alert) => (
                        <div
                            key={alert.id}
                            className={`flex items-start justify-between rounded-2xl border p-5 transition ${
                                alert.is_read ? "border-slate-200 bg-white" : "border-blue-100 bg-blue-50 shadow-sm"
                            }`}
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    {!alert.is_read && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                                    <h3 className={`font-semibold ${alert.is_read ? "text-slate-700" : "text-[#001F3F]"}`}>
                                        {alert.title}
                                    </h3>
                                </div>
                                <p className={`mt-1 text-sm ${alert.is_read ? "text-slate-500" : "text-slate-700"}`}>
                                    {alert.message}
                                </p>
                                <p className="mt-2 text-xs text-slate-400">
                                    {new Date(alert.created_at).toLocaleString()}
                                </p>
                            </div>

                            {!alert.is_read && (
                                <button
                                    onClick={() => markAsRead(alert.id)}
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