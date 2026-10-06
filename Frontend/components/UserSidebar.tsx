import Link from "next/link";
import {
  LayoutDashboard,
  Car,
  Wrench,
  MapPin,
  Hammer,
  CalendarDays,
} from "lucide-react";

const links = [
  {
    name: "Dashboard",
    href: "/userDashboard",
    icon: LayoutDashboard,
  },
  {
    name: "My Garage",
    href: "/garage",
    icon: Car,
  },
  {
    name: "Maintenance",
    href: "/maintenance",
    icon: Wrench,
  },
  {
    name: "Find Mechanics",
    href: "/mechanics",
    icon: MapPin,
  },
  {
    name: "ToolDrop",
    href: "/tooldrop",
    icon: Hammer,
  },
  {
    name: "My Rentals",
    href: "/rentals",
    icon: CalendarDays,
  },
];

export default function UserSidebar() {
  return (
    <aside className="min-h-screen w-64 bg-[#001F3F] px-5 py-8 text-white">
      <h1 className="mb-12 text-3xl font-bold">
        MotorMate
      </h1>

      <nav className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;

          return (
            <Link
              key={link.name}
              href={link.href}
              className="flex items-center gap-3 rounded-lg px-4 py-3 transition hover:bg-white/10"
            >
              <Icon size={20} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}