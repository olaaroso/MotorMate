import MechanicSidebar from "@/components/MechanicSidebar";
import MechanicMenu from "@/components/MechanicMenu";
import { Bell } from "lucide-react";

export default function MechanicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-[#F7F9FC]">
      <MechanicSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-end border-b border-white/10 bg-[#001F3F] px-5 sm:px-8">
          <button
            type="button"
            aria-label="Notifications"
            className="mr-3 flex h-10 w-10 items-center justify-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <Bell size={19} />
          </button>

          <div className="h-6 w-px bg-white/20" />

          <div className="ml-3">
            <MechanicMenu />
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
