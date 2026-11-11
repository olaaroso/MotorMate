"use client";

import { useState, type FormEvent } from "react";
import { X, Send, Loader2, MessageSquare } from "lucide-react";

interface RentalMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    recipientName: string;
    recipientRole: "Owner" | "Renter";
    itemName: string;
}

export default function RentalMessageModal({
                                               isOpen,
                                               onClose,
                                               recipientName,
                                               recipientRole,
                                               itemName,
                                           }: RentalMessageModalProps) {
    const [message, setMessage] = useState("");
    const [isSending, setIsSending] = useState(false);

    if (!isOpen) return null;

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSending(true);

        try {

            await new Promise((resolve) => setTimeout(resolve, 800));

            setMessage("");
            onClose();
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm transition-opacity">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#001F3F] text-white">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Message {recipientRole}: {recipientName}
                            </h2>
                            <p className="text-sm text-slate-500">Regarding: {itemName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body & Form */}
                <form onSubmit={handleSendMessage} className="p-6">
          <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Type your message to ${recipientName} here...`}
              className="h-32 w-full resize-none rounded-xl border border-slate-300 p-4 text-sm outline-none transition focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F]"
              required
          />

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSending || !message.trim()}
                            className="flex items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#003366] disabled:opacity-70"
                        >
                            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            Send Message
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}