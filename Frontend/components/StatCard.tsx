import { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
};

export default function StatCard({
  title,
  value,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border bg-gray-100 p-5">

      <p className="text-sm text-gray-600">
        {title}
      </p>

      <div className="mt-4 flex items-center gap-4">

        <Icon
          size={30}
          className="text-[#001F3F]"
        />

        <span className="text-3xl font-bold">
          {value}
        </span>

      </div>

    </div>
  );
}