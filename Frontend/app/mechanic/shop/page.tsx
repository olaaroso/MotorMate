import { Store } from "lucide-react";

export default function MechanicShopPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-9">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
          My Shop
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Shop Profile
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          Manage your business name, address, contact information, and
          operating hours.
        </p>
      </section>

      <section className="mt-8 flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#001F3F]/6 text-[#001F3F]">
          <Store size={26} />
        </div>

        <h2 className="mt-5 text-lg font-semibold text-slate-950">
          Shop profile editing is coming soon
        </h2>

        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          This page will let you create and update your shop&apos;s business
          information.
        </p>
      </section>
    </div>
  );
}
