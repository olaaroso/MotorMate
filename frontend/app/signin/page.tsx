"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SigninPage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      // Log the user into Firebase
      await signInWithEmailAndPassword(auth, email, password);

      // Send them to the user homepage
      router.push("/userDashboard");
    } catch (error) {
      console.error(error);
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

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
          <form
            onSubmit={handleSignin}
            className="mx-auto mt-10 w-full max-w-[420px]"
          >

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
                name="email"
                type="email"
                required
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
                name="password"
                type="password"
                required
                className="h-[52px] w-full rounded-lg bg-[#D9D9D9] px-4 text-black outline-none transition focus:ring-2 focus:ring-[#001F3F]"
              />
            </div>


            {/* Error Message */}
            {error && (
              <p className="mt-4 text-sm text-red-600">
                {error}
              </p>
            )}


            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-8 h-[54px] w-full rounded-lg bg-[#002C5A] text-2xl text-white shadow-lg transition hover:bg-[#00386f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logging In..." : "Log In"}
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