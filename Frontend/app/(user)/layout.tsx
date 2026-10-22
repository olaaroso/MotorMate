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
          <header className="sticky top-0 z-50 flex h-20 w-full shrink-0 items-center justify-end border-b border-white/10 bg-[#001F3F] px-6 sm:px-10">
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