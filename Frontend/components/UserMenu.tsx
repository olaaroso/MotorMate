"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Car,
  ChevronDown,
  CircleHelp,
  Hammer,
  LogOut,
  MessageSquare,
  Moon,
  User,
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("MotorMate User");
  const [email, setEmail] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setName("MotorMate User");
        setEmail("");
        return;
      }

      setName(
        user.displayName?.trim() ||
          user.email?.split("@")[0] ||
          "MotorMate User"
      );
      setEmail(user.email || "");
    });

    return unsubscribe;
  }, []);

  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!parts.length) return "MM";
    return parts.map((part) => part[0]?.toUpperCase()).join("");
  }, [name]);

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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open account menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl p-1.5 pr-2.5 transition hover:bg-white/10"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-xs font-bold text-[#001F3F] shadow-sm">
          {initials}
        </div>

        <ChevronDown
          size={14}
          className={`text-white/60 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-3 w-77.5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="flex gap-3 px-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#001F3F] text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{name}</p>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {email || "Signed in to MotorMate"}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 py-2">
            <MenuLink href="/account" icon={User} label="Account" onClick={() => setOpen(false)} />
            <MenuLink href="/garage" icon={Car} label="My Garage" onClick={() => setOpen(false)} />
            <MenuLink href="/tooldrop" icon={Hammer} label="ToolDrop" onClick={() => setOpen(false)} />
            <MenuLink href="/rentals" icon={CalendarDays} label="My Rentals" onClick={() => setOpen(false)} />
          </div>

          <div className="border-t border-slate-100 py-2">
            <MenuLink href="/notifications" icon={Bell} label="Notifications" onClick={() => setOpen(false)} />
            <MenuLink href="/appearance" icon={Moon} label="Appearance" onClick={() => setOpen(false)} />
          </div>

          <div className="border-t border-slate-100 py-2">
            <MenuLink href="/help" icon={CircleHelp} label="Help" onClick={() => setOpen(false)} />
            <MenuLink href="/feedback" icon={MessageSquare} label="Send Feedback" onClick={() => setOpen(false)} />
          </div>

          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={18} />
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

function MenuLink({ href, icon: Icon, label, onClick }: MenuLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
    >
      <Icon size={18} className="text-slate-500" />
      <span>{label}</span>
    </Link>
  );
}
