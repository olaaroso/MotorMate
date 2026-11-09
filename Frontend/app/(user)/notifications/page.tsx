import NotificationsView from "@/components/NotificationsView";

export default async function NotificationsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { view } = await searchParams;
    const initialView = view === "history" ? "history" : "inbox";

    return (
        <NotificationsView
            key={initialView}
            initialView={initialView}
            subtitle="Stay updated on your tool rentals, appointments, and garage alerts."
        />
    );
}
