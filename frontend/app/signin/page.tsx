"use client";

import { useState } from "react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="grid min-h-screen w-full md:grid-cols-2">

      {/* LEFT PANEL — hidden on small screens, shown from md up */}
      <div className="hidden flex-col justify-between bg-[#001F3F] p-10 text-white md:flex">
        <div className="text-xl font-semibold">
          MotorMate
        </div>

        <div>
          <h1 className="text-2xl font-semibold leading-snug">
            Track your car&apos;s health. Borrow the tools to fix it.
          </h1>
          <p className="mt-3 text-sm text-gray-300">
            Maintenance alerts, local mechanics, and a neighborhood tool
            library.
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — the form */}
      <div className="flex items-center justify-center bg-[#F8F8FF] p-8 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile-only brand mark, since the left panel is hidden here */}
          <div className="mb-8 text-lg font-semibold text-[#001F3F] md:hidden">
            MotorMate
          </div>

          <h2 className="text-2xl font-semibold text-[#001F3F]">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Log in to your account.
            </p>

            <form className="mt-8 space-y-5">
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-[#001F3F]"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-[#001F3F] placeholder:text-gray-400 focus:border-[#001F3F] focus:outline-none focus:ring-1 focus:ring-[#001F3F]"
                />
              </div>

              {/* PASSWORD */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-[#001F3F]"
                  >
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-xs font-medium text-[#001F3F] underline underline-offset-2"
                  >
                    Forgot password?
                  </a>
                </div>

                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-[#001F3F] placeholder:text-gray-400 focus:border-[#001F3F] focus:outline-none focus:ring-1 focus:ring-[#001F3F]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-[#001F3F]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* LOG IN BUTTON */}
              <button
                type="submit"
                className="w-full rounded-lg bg-[#001F3F] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a2c52] focus:outline-none focus:ring-2 focus:ring-[#001F3F] focus:ring-offset-2"
              >
                Log in
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400">or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <p className="mt-6 text-center text-sm text-gray-500">
              New here?{" "}
              <a
                href="#"
                className="font-semibold text-[#001F3F] underline underline-offset-2"
              >
                Sign up
              </a>
            </p>
        </div>
      </div>
    </div>
  );
}