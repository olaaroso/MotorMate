import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  helper?: string;
  tone?: "blue" | "amber" | "green" | "slate";
};

const toneStyles = {
  blue: {
    icon: "bg-sky-50 text-[#001F3F]",
    helper: "text-sky-700",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700",
    helper: "text-amber-700",
  },
  green: {
    icon: "bg-emerald-50 text-emerald-700",
    helper: "text-emerald-700",
  },
  slate: {
    icon: "bg-slate-100 text-slate-700",
    helper: "text-slate-500",
  },
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  helper,
  tone = "blue",
}: StatCardProps) {
  const styles = toneStyles[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles.icon}`}
        >
          <Icon size={20} />
        </div>
      </div>

      {helper && (
        <p className={`mt-4 text-xs font-semibold ${styles.helper}`}>
          {helper}
        </p>
      )}
    </div>
  );
}
