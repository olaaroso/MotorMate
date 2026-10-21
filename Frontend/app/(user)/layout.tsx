import UserSidebar from "@/components/UserSidebar";
import UserMenu from "@/components/UserMenu";
import NotificationBell from "@/components/NotificationBell";
import {Bell} from "lucide-react";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-[#F7F9FC]">
      <UserSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-end border-b border-white/10 bg-[#001F3F] px-5 sm:px-8">
            <NotificationBell/>

          <div className="h-6 w-px bg-white/20" />

          <div className="ml-3">
            <UserMenu />
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}