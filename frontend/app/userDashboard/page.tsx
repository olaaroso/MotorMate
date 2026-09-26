export default function Home() {
  return (
    <div className="flex min-h-screen bg-[#F8F8FF]">

      {/* Sidebar */}
      <aside className="w-64 bg-[#001F3F] p-6 text-white">
        <h1 className="mb-10 text-2xl font-bold">
          MotorMate
        </h1>

        <nav className="space-y-4">
          <p className="cursor-pointer">Dashboard</p>
          <p className="cursor-pointer">My Garage</p>
          <p className="cursor-pointer">Maintenance</p>
          <p className="cursor-pointer">Find Mechanics</p>
          <p className="cursor-pointer">ToolDrop</p>
          <p className="cursor-pointer">My Rentals</p>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">

        <h2 className="text-3xl font-bold text-[#001F3F]">
          Dashboard
        </h2>

        <p className="mt-2 text-gray-600">
          Welcome back to MotorMate.
        </p>

        {/* Vehicle Card */}
        <div className="mt-8 max-w-md rounded-xl border border-gray-300 bg-white p-6 shadow-sm">

          <h3 className="text-xl font-semibold text-[#001F3F]">
            2019 Honda Civic
          </h3>

          <p className="mt-2 text-gray-600">
            Mileage: 74,200 miles
          </p>

          <div className="mt-4">
            <p className="font-medium">
              Next Maintenance
            </p>

            <p className="text-gray-600">
              Oil Change — approximately 1,200 miles
            </p>
          </div>

          <button className="mt-6 rounded-lg bg-[#001F3F] px-4 py-2 text-white">
            View Vehicle
          </button>

        </div>

      </main>

    </div>
  );
}