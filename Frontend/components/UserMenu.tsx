"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  Bell,
  Car,
  ChevronDown,
  CircleHelp,
  Hammer,
  LogOut,
  MessageSquare,
  Moon,
  User,
} from "lucide-react";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setOpen(false);
      router.push("/signin");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      {/* PROFILE BUTTON */}

<button
  type="button"
  onClick={() => setOpen((prev) => !prev)}
  aria-label="Open account menu"
  className="
    flex h-10 w-10
    items-center justify-center
    rounded-full
    bg-[#E9EEF5]
    text-sm font-bold text-[#001F3F]
    transition
    hover:bg-[#DDE5EE]
    focus:outline-none
  "
>
  JD
</button>

      {/* DROPDOWN */}

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-[300px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {/* PROFILE HEADER */}

          <div className="flex gap-3 px-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#001F3F] text-sm font-bold text-white">
              JD
            </div>

            <div>
              <p className="font-semibold text-gray-900">
                John Doe
              </p>

              <p className="text-sm text-gray-500">
                john@example.com
              </p>
            </div>
          </div>

          {/* MAIN LINKS */}

          <div className="border-t border-gray-200 py-2">
            <MenuLink
              href="/account"
              icon={User}
              label="Account"
              onClick={() => setOpen(false)}
            />

            <MenuLink
              href="/garage"
              icon={Car}
              label="My Garage"
              onClick={() => setOpen(false)}
            />

            <MenuLink
              href="/tooldrop"
              icon={Hammer}
              label="ToolDrop"
              onClick={() => setOpen(false)}
            />

            <MenuLink
              href="/rentals"
              icon={Car}
              label="My Rentals"
              onClick={() => setOpen(false)}
            />
          </div>

          {/* PREFERENCES */}

          <div className="border-t border-gray-200 py-2">
            <MenuLink
              href="/notifications"
              icon={Bell}
              label="Notifications"
              onClick={() => setOpen(false)}
            />

            <MenuLink
              href="/appearance"
              icon={Moon}
              label="Appearance"
              onClick={() => setOpen(false)}
            />
          </div>

          {/* SUPPORT */}

          <div className="border-t border-gray-200 py-2">
            <MenuLink
              href="/help"
              icon={CircleHelp}
              label="Help"
              onClick={() => setOpen(false)}
            />

            <MenuLink
              href="/feedback"
              icon={MessageSquare}
              label="Send Feedback"
              onClick={() => setOpen(false)}
            />
          </div>

          {/* SIGN OUT */}

          <div className="border-t border-gray-200 py-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-4 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={19} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type MenuLinkProps = {
  href: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
};

function MenuLink({
  href,
  icon: Icon,
  label,
  onClick,
}: MenuLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-2.5 text-sm text-gray-800 transition hover:bg-gray-100"
    >
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  );
}