import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">

      {/* TOP NAVY SECTION */}
      <section className="relative h-[560px] overflow-hidden">

        {/* Diagonal navy background */}
        <div
          className="absolute inset-0 bg-[#001F3F]"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 38%, 0 100%)",
          }}
        />

        {/* Content on top of navy */}
        <div className="relative z-10">

          {/* NAVBAR */}
          <nav className="flex items-center justify-between px-11 py-5">
            <h1 className="font-serif text-3xl text-white">
              MotorMate
            </h1>

            <div className="flex gap-6">
              <Link
                href="/signin"
                className="rounded-xl bg-white px-12 py-3 text-lg text-[#001F3F] shadow-lg transition hover:bg-gray-100"
              >
                Log In
              </Link>

              <Link
                href="/signup"
                className="rounded-xl bg-white px-12 py-3 text-lg text-[#001F3F] shadow-lg transition hover:bg-gray-100"
              >
                Sign Up
              </Link>
            </div>
          </nav>

          {/* NAV LINE */}
          <div className="mx-11 h-px bg-white/40" />

          {/* HERO */}
          <div className="px-11 pt-5">
            <h2 className="font-serif text-5xl text-white">
              Stay Ahead of Your Repairs
            </h2>

            <p className="mt-3 font-serif text-2xl font-semibold leading-snug text-white">
              Know what&apos;s next
              <br />
              for your car.
            </p>

            <div className="mt-3 flex justify-center">
              <Link
                href="/signup"
                className="rounded-xl bg-[#D9D9D9] px-16 py-3 text-xl text-[#001F3F] shadow-lg transition hover:bg-white"
              >
                Get Started
              </Link>
            </div>
          </div>

          {/* HOW IT WORKS HEADING */}
          <div className="px-11 pt-14">
            <h2 className="font-serif text-4xl leading-tight text-white underline underline-offset-4">
              How MotorMate
              <br />
              Works?
            </h2>
          </div>

        </div>
      </section>


      {/* WHITE LOWER SECTION */}
      <section className="px-12 pb-16 pt-4">
        <div className="grid grid-cols-[1fr_300px] gap-20">

          {/* STEPS */}
          <div className="ml-44 space-y-6 text-[#001F3F]">

            <div>
              <h3 className="font-serif text-2xl">
                1. Add Your Car
              </h3>

              <p className="ml-2 font-serif italic text-gray-700">
                Enter your VIN or vehicle details.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-2xl">
                2. Build Your Garage
              </h3>

              <p className="ml-2 font-serif italic text-gray-700">
                Keep your vehicles and maintenance history organized.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-2xl">
                3. Stay Informed
              </h3>

              <p className="ml-2 font-serif italic text-gray-700">
                See what maintenance your car needs next.
              </p>
            </div>

            <div>
              <h3 className="font-serif text-2xl">
                4. Connect
              </h3>

              <p className="ml-2 font-serif italic text-gray-700">
                Connect with nearby mechanics or tool owners for renting.
              </p>
            </div>

          </div>


          {/* GARAGE PREVIEW */}
          <div className="-mt-20 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-gray-300">

            <div className="py-6">
              <h3 className="text-center font-bold text-black">
                My Garage
              </h3>
            </div>

            <div className="h-9 bg-[#001F3F]" />

            {/* CAR 1 */}
            <div className="m-4 rounded-lg bg-[#D9D9D9] p-4 text-black">
              <p className="font-bold">
                Car Model 1
              </p>

              <p className="text-sm">
                Mileage: 74,200
              </p>

              <p className="text-sm">
                Oil Change - 1,200 mi
              </p>

              <p className="text-sm font-semibold">
                Active Maintenance:
              </p>

              <button className="mt-2 text-sm underline">
                Expand
              </button>
            </div>

            {/* CAR 2 */}
            <div className="m-4 rounded-lg bg-[#D9D9D9] p-4 text-black">
              <p className="font-bold">
                Car Model 2
              </p>

              <p className="text-sm">
                Mileage: 135,500
              </p>

              <p className="text-sm">
                Oil Change - 2,000 mi
              </p>

              <p className="text-sm font-semibold">
                Active Maintenance:
              </p>

              <button className="mt-2 text-sm underline">
                Expand
              </button>
            </div>

          </div>

        </div>
      </section>

    </main>
  );
}