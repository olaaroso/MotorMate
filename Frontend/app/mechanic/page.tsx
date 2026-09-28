export default function MechanicPage() {
  return (
    <div className="min-h-screen bg-[#F8F8FF]">

      {/* NAVBAR */}
      <header className="bg-[#001F3F] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">

          <h1 className="text-3xl font-semibold">
            MotorMate
          </h1>

          <nav className="flex items-center gap-12 text-lg font-semibold">
            <a href="#">Dashboard</a>
            <a href="#">Repair Requests</a>
            <a href="#">My Shop</a>

            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-bold text-[#001F3F]">
              JM
            </div>
          </nav>

        </div>
      </header>


      {/* MAIN CONTENT */}
      <main className="mx-auto max-w-6xl px-10 py-8">

        {/* WELCOME + STATUS */}
        <section className="flex items-start justify-between">

          <div>
            <h2 className="text-3xl font-bold">
              Welcome, Jason&apos;s Auto Repair
            </h2>

            <p className="mt-1 text-gray-500">
              Here&apos;s what&apos;s happening at your shop.
            </p>
          </div>


          <div className="flex items-center gap-4 bg-gray-200 px-7 py-5">
            <div className="h-4 w-4 rounded-full bg-green-600" />

            <p className="text-xl font-bold">
              Accepting Requests
            </p>
          </div>

        </section>


        {/* STAT CARDS */}
        <section className="mt-10 grid grid-cols-3 gap-10">

          <div className="bg-gray-200 p-5">
            <p>Open Requests</p>
            <p className="mt-2 text-5xl font-bold">0</p>
          </div>

          <div className="bg-gray-200 p-5">
            <p>Services Offered</p>
            <p className="mt-2 text-5xl font-bold">6</p>
          </div>

          <div className="bg-gray-200 p-5">
            <p>Labor Rate</p>
            <p className="mt-2 text-5xl font-bold">$110/hr</p>
          </div>

        </section>


        {/* BOTTOM SECTION */}
        <section className="mt-12 grid grid-cols-2 gap-12">

          {/* REPAIR REQUESTS */}
          <div className="bg-gray-200 p-6">

            <h3 className="text-2xl font-bold">
              Repair Requests
            </h3>

            <div className="mt-5 bg-white p-5">

              <div className="flex justify-between">

                <div>
                  <p className="font-bold">
                    Brake Inspection
                  </p>

                  <p>
                    2015 Honda Civic
                  </p>

                  <p>
                    Requested by J. Martinez
                  </p>
                </div>

                <span className="font-semibold text-yellow-600">
                  Pending
                </span>

              </div>


              <div className="mt-5 flex gap-4">

                <button className="bg-gray-200 px-4 py-2">
                  Accept
                </button>

                <button className="bg-gray-200 px-4 py-2">
                  Decline
                </button>

                <button className="bg-gray-200 px-4 py-2">
                  View Details
                </button>

              </div>

            </div>

          </div>


          {/* SHOP PROFILE */}
          <div className="bg-gray-200 p-6">

            <div className="flex justify-between">

              <h3 className="text-2xl font-bold">
                Shop Profile
              </h3>

              <button className="text-sm">
                Edit
              </button>

            </div>

            <div className="mt-6 space-y-5">

              <p>
                123 Main St, Farmingdale
              </p>

              <p>
                Mon-Sat, 8am-5pm
              </p>

              <p>
                Brakes, oil, tires, diagnostics
              </p>

              <p>
                $110/hr labor rate
              </p>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}