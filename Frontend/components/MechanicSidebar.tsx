"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  Store,
  Wrench,
  ChevronRight,
} from "lucide-react";

const links = [
  { name: "Dashboard", href: "/mechanic", icon: LayoutDashboard },
  { name: "Repair Requests", href: "/mechanic/requests", icon: ClipboardList },
  { name: "My Shop", href: "/mechanic/shop", icon: Store },
];

export default function MechanicSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-18 shrink-0 flex-col border-r border-white/10 bg-[#001F3F] px-2 py-5 text-white lg:w-68 lg:px-4">
      <Link
        href="/mechanic"
        className="flex items-center justify-center gap-3 rounded-2xl px-1 py-2 lg:justify-start lg:px-3"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 shadow-sm">
          <Image
            src="/MotorMate_Logo.png"
            alt="MotorMate"
            width={44}
            height={44}
            priority
            className="h-full w-full object-contain"
          />
        </div>

        <div className="hidden lg:block">
          <p className="text-lg font-bold tracking-tight">MotorMate</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
            Mechanic Portal
          </p>
        </div>
      </Link>

      <div className="mt-8 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35 lg:block">
        Shop Workspace
      </div>

      <nav className="mt-3 space-y-1.5 lg:mt-3">
        {links.map((link) => {
          const Icon = link.icon;
          const active =
            pathname === link.href ||
            (link.href !== "/mechanic" && pathname.startsWith(`${link.href}/`));

          return (
            <Link
              key={link.name}
              href={link.href}
              title={link.name}
              className={`group flex items-center justify-center gap-3 rounded-xl px-2 py-3 text-sm font-medium transition lg:justify-start lg:px-3 ${
                active
                  ? "bg-white text-[#001F3F] shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                  active
                    ? "bg-[#001F3F]/[0.07]"
                    : "bg-white/6 group-hover:bg-white/10"
                }`}
              >
                <Icon size={17} />
              </div>

              <span className="hidden flex-1 lg:block">{link.name}</span>

              {active && (
                <ChevronRight
                  size={15}
                  className="hidden text-[#001F3F]/55 lg:block"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden rounded-2xl border border-white/10 bg-white/6 p-4 lg:block">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
          <Wrench size={17} />
        </div>
        <p className="mt-4 text-sm font-semibold">
          Run your shop, simplified.
        </p>
        <p className="mt-1 text-xs leading-5 text-white/50">
          Requests, shop profile, and services all in one place.
        </p>
      </div>
    </aside>
  );
}
