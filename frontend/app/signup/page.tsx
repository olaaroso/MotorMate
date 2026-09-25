"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export default function SignupPage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const phone = formData.get("phone") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const accountType = formData.get("accountType") as string;

    // Make sure passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    // Make sure account type is selected
    if (!accountType) {
      setError("Please select an account type.");
      setLoading(false);
      return;
    }

    try {
      // Create Firebase Authentication account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      // Store extra MotorMate information in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        phone: phone,
        accountType: accountType,
        createdAt: serverTimestamp(),
      });

      // Send user to dashboard after successful signup
      router.push("/signin");
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        if (error.message.includes("auth/email-already-in-use")) {
          setError("An account with this email already exists.");
        } else if (error.message.includes("auth/weak-password")) {
          setError("Password must be at least 6 characters.");
        } else if (error.message.includes("auth/invalid-email")) {
          setError("Please enter a valid email address.");
        } else {
          setError("Something went wrong while creating your account.");
        }
      }
    } finally {
      setLoading(false);
    }
  }

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
          <form
            onSubmit={handleSignup}
            className="mx-auto mt-5 w-full max-w-[370px]"
          >

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
                name="phone"
                type="tel"
                required
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 text-black outline-none"
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
                name="email"
                type="email"
                required
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 text-black outline-none"
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
                name="password"
                type="password"
                required
                minLength={6}
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 text-black outline-none"
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
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                className="h-[48px] w-full rounded-lg bg-[#D9D9D9] px-3 text-black outline-none"
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
                    required
                    className="h-4 w-4"
                  />
                  Individual
                </label>

                <label className="flex cursor-pointer items-center gap-1">
                  <input
                    type="radio"
                    name="accountType"
                    value="business"
                    required
                    className="h-4 w-4"
                  />
                  Business
                </label>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* Sign Up button */}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 h-[54px] w-full rounded-lg bg-[#002C5A] text-2xl text-white shadow-lg transition hover:bg-[#00386f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating Account..." : "Sign Up"}
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