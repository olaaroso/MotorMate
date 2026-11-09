import NotificationsView from "@/components/NotificationsView";

export default async function MechanicNotificationsPage({
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
      subtitle="Stay updated on repair requests and appointments for your shop."
    />
  );
}
