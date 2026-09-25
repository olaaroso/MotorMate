import Link from "next/link";

export default function SigninPage() {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[46%_54%]">

      {/* LEFT SIDE */}
      <section className="hidden min-h-screen bg-[#001F3F] text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10">

        {/* Logo */}
        <h1 className="font-serif text-4xl font-semibold">
          MotorMate
        </h1>

        {/* Bottom Text */}
        <div className="mb-12">
          <h2 className="font-serif text-4xl font-normal">
            Track your car&apos;s health.
          </h2>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-gray-200">
            Maintenance alerts, local mechanics,
            <br />
            and a neighborhood tool library.
          </p>
        </div>
      </section>


      {/* RIGHT SIDE */}
      <section className="flex min-h-screen items-center justify-center bg-white px-8 py-12">

        <div className="w-full max-w-[560px]">

          {/* Heading */}
          <h2 className="font-serif text-5xl font-normal text-black">
            Welcome Back
          </h2>

          <p className="mt-4 text-lg text-gray-700">
            Log in to your MotorMate account.
          </p>

          <div className="mt-4 h-px w-full bg-gray-400" />


          {/* FORM */}
          <form className="mx-auto mt-10 w-full max-w-[420px]">

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm text-black"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                className="h-[52px] w-full rounded-lg bg-[#D9D9D9] px-4 text-black outline-none transition focus:ring-2 focus:ring-[#001F3F]"
              />
            </div>


            {/* Password */}
            <div className="mt-5">
              <label
                htmlFor="password"
                className="mb-2 block text-sm text-black"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                className="h-[52px] w-full rounded-lg bg-[#D9D9D9] px-4 text-black outline-none transition focus:ring-2 focus:ring-[#001F3F]"
              />
            </div>


            {/* Login Button */}
            <button
              type="submit"
              className="mt-8 h-[54px] w-full rounded-lg bg-[#002C5A] text-2xl text-white shadow-lg transition hover:bg-[#00386f]"
            >
              Log In
            </button>

          </form>


          {/* OR */}
          <div className="mx-auto mt-10 flex w-full max-w-[420px] items-center gap-4">

            <div className="h-px flex-1 bg-gray-400" />

            <span className="text-sm text-gray-600">
              or
            </span>

            <div className="h-px flex-1 bg-gray-400" />

          </div>


          {/* Signup Link */}
          <div className="mt-8 text-center text-sm text-black">
            <span>New here? </span>

            <Link
              href="/signup"
              className="underline underline-offset-2"
            >
              Sign Up
            </Link>
          </div>

        </div>
      </section>

    </main>
  );
}