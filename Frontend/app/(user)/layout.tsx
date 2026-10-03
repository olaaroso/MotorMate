import UserSidebar from "@/components/UserSidebar";
import UserMenu from "@/components/UserMenu";
import { Bell } from "lucide-react";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-[#F8F8FF]">

      <UserSidebar />

      <div className="flex min-w-0 flex-1 flex-col">

        {/* Top bar */}
        <header className="flex h-20 items-center justify-end border-b bg-white px-8">

          <Bell
            size={22}
            className="mr-6 text-[#001F3F]"
          />

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-200 font-semibold text-[#001F3F]">
            <UserMenu />
          </div>

        </header>

        {/* Page goes here */}
        <main className="flex-1">
          {children}
        </main>

      </div>
    </div>
  );
}