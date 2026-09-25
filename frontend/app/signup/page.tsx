import { Check } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[54%_46%]">

      {/* LEFT SIDE */}
      <section className="flex min-h-screen items-center justify-center bg-white px-8 py-10">
        <div className="w-full max-w-[590px]">

          {/* Heading */}
          <h1 className="font-serif text-5xl font-normal text-black">
            Let&apos;s Get Started
          </h1>

          <div className="mt-5 text-center font-serif text-3xl leading-tight text-black">
            <p>Your Garage,</p>
            <p className="ml-28">Upgraded.</p>
          </div>

          {/* Intro text */}
          <p className="mt-8 text-xs text-black">
            Welcome to MotorMate let&apos;s create your account.
          </p>

          <div className="mt-1 h-px w-full bg-gray-500" />

          {/* FORM */}
          <form className="mx-auto mt-5 w-full max-w-[370px]">

            {/* Phone */}
            <div className="mb-3">
              <label
                htmlFor="phone"
                className="mb-1 block text-xs text-black"
              >
                Phone Number
              </label>

              <input
                id="phone"
                type="tel"
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 outline-none"
              />
            </div>

            {/* Email */}
            <div className="mb-3">
              <label
                htmlFor="email"
                className="mb-1 block text-xs text-black"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 outline-none"
              />
            </div>

            {/* Password */}
            <div className="mb-3">
              <label
                htmlFor="password"
                className="mb-1 block text-xs text-black"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 outline-none"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-xs text-black"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 outline-none"
              />
            </div>

            {/* Account type */}
            <div className="mt-4">
              <p className="text-sm leading-tight text-black">
                Are you creating an account as an
                <br />
                individual or as a business/mechanic?
              </p>

              <div className="mt-2 flex gap-14 text-xs text-black">
                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="accountType"
                    value="individual"
                    className="h-4 w-4"
                  />
                  Individual
                </label>

                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="accountType"
                    value="business"
                    className="h-4 w-4"
                  />
                  Business
                </label>
              </div>
            </div>

            {/* Sign Up button */}
            <button
              type="submit"
              className="mt-4 h-[54px] w-full rounded-lg bg-[#002C5A] text-2xl text-white shadow-lg transition hover:bg-[#00386f]"
            >
              Sign Up
            </button>
          </form>

          {/* Bottom separator */}
          <div className="mt-11 h-px w-full bg-gray-500" />

          {/* Login */}
          <div className="mt-9 text-center text-sm text-black">
            <p>Already have an account?</p>

            <Link
              href="/signin"
              className="underline underline-offset-2"
            >
              Log In
            </Link>
          </div>

        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="hidden min-h-screen bg-[#001F3F] text-white lg:flex lg:flex-col lg:items-center">

        <div className="mt-14 text-center">
          <h2 className="text-4xl font-normal">
            MotorMate
          </h2>

          <p className="mt-9 text-lg">
            Your car care.
          </p>

          <p className="mt-5 text-lg">
            All in one place.
          </p>

          <div className="mx-auto mt-6 h-px w-[230px] bg-gray-300" />
        </div>

        {/* Benefits */}
        <div className="mt-28 space-y-16">

          <div className="flex items-center gap-8">
            <Check
              size={48}
              strokeWidth={1.5}
              className="shrink-0"
            />

            <p className="text-xl leading-tight">
              Stay Ahead on
              <br />
              Maintenance
            </p>
          </div>

          <div className="flex items-center gap-8">
            <Check
              size={48}
              strokeWidth={1.5}
              className="shrink-0"
            />

            <p className="text-xl">
              Find Tools Nearby
            </p>
          </div>

          <div className="flex items-center gap-8">
            <Check
              size={48}
              strokeWidth={1.5}
              className="shrink-0"
            />

            <p className="text-xl leading-tight">
              Connect with
              <br />
              Trusted Mechanics
            </p>
          </div>

        </div>
      </section>

    </main>
  );
}