const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const MAX_MESSAGE_LENGTH = 1000;

export class MessagesRequestError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.status = status;
    }
}

export type RentalMessage = {
    id: string;
    rental_id: string;
    sender_id: string;
    sender_role: "owner" | "borrower";
    body: string;
    created_at: string;
    read_at?: string;
};

export type RequestThread = {
    messages: RentalMessage[];
    unread_count: number;
    can_send: boolean;
    status: string;
};

export async function fetchRequestThread(
    rentalId: string,
    actorId: string,
    role: "owner" | "borrower"
): Promise<RequestThread> {
    const params = new URLSearchParams({ actor_id: actorId, role });
    const res = await fetch(`${apiUrl}/api/diy/rental-messages/${rentalId}?${params}`);

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new MessagesRequestError(data.detail || "Failed to load messages", res.status);
    }
    return res.json();
}

export async function sendRequestMessage(
    rentalId: string,
    actorId: string,
    role: "owner" | "borrower",
    body: string
): Promise<RentalMessage> {
    const params = new URLSearchParams({ actor_id: actorId, role });
    const res = await fetch(`${apiUrl}/api/diy/rental-messages/${rentalId}?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new MessagesRequestError(data.detail || "Failed to send message", res.status);
    }
    return res.json();
}

export async function markRequestThreadRead(
    rentalId: string,
    actorId: string,
    role: "owner" | "borrower"
): Promise<void> {
    const params = new URLSearchParams({ actor_id: actorId, role });
    await fetch(`${apiUrl}/api/diy/rental-messages/${rentalId}/read?${params}`, {
        method: "PATCH",
    });
}