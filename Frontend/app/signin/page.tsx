"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function SigninPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [verifyName, setVerifyName] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  async function handleSignin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
      );

      const user = userCredential.user;
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists()) {
        setError("Your account exists, but your MotorMate profile was not found.");
        return;
      }

      const userData = userDoc.data();

      if (userData.accountType === "business") {
        router.push("/mechanic");
      } else {
        router.push("/userDashboard");
      }
    } catch (error: any) {
      if (
          error.code === "auth/invalid-credential" ||
          error.code === "auth/wrong-password" ||
          error.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password.");
      } else if (error.code === "permission-denied") {
        setError("Logged in, but Firestore permission was denied.");
      } else {
        setError(`Login error: ${error.code || error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDirectReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResetError("");
    setResetSuccess("");
    setResetLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/reset-password-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail.trim(),
          verification_name: verifyName.trim(),
          new_password: resetNewPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Password reset failed.");
      }
      setResetSuccess("Password updated! You can now log in with your new password.");
      setResetNewPassword("");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
      <main className="min-h-screen bg-white lg:grid lg:grid-cols-[46%_54%]">
        {/* LEFT SIDE */}
        <section className="hidden min-h-screen bg-[#001F3F] text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10">
          <div className="flex justify-center pt-10">
            <Image
                src="/MotorMate_Mascot.png"
                alt="MotorMate mascot"
                width={320}
                height={320}
                className="h-auto w-96 max-w-full"
                priority
            />
          </div>

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
              <div>
                <label htmlFor="email" className="mb-2 block text-sm text-black">
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

              <div className="mt-5">
                <label htmlFor="password" className="mb-2 block text-sm text-black">
                  Password
                </label>

                <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="h-[52px] w-full rounded-lg bg-[#D9D9D9] px-4 text-black outline-none transition focus:ring-2 focus:ring-[#001F3F]"
                />

                <div className="mt-2 flex justify-end">
                  <button
                      type="button"
                      onClick={() => {
                        setResetError("");
                        setResetSuccess("");
                        setResetOpen(true);
                      }}
                      className="text-xs font-semibold text-[#001F3F] underline underline-offset-2 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

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
              <span className="text-sm text-gray-600">or</span>
              <div className="h-px flex-1 bg-gray-400" />
            </div>

            {/* Signup Link */}
            <div className="mt-8 text-center text-sm text-black">
              <span>New here? </span>
              <Link href="/signup" className="underline underline-offset-2">
                Sign Up
              </Link>
            </div>
          </div>
        </section>

        {/* DIRECT PASSWORD RESET MODAL */}
        {resetOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-xl font-bold text-[#001F3F]">Reset Password</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Verify your account email and registered first name (or shop name) to set a new password immediately.
                </p>

                <form onSubmit={handleDirectReset} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600">
                      Account Email
                    </label>
                    <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-black outline-none focus:border-[#001F3F]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600">
                      First Name or Shop Name
                    </label>
                    <input
                        type="text"
                        required
                        value={verifyName}
                        onChange={(e) => setVerifyName(e.target.value)}
                        placeholder="Enter your registered first name"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-black outline-none focus:border-[#001F3F]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-600">
                      New Password (min 6 characters)
                    </label>
                    <input
                        type="password"
                        required
                        minLength={6}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-black outline-none focus:border-[#001F3F]"
                    />
                  </div>

                  {resetError && <p className="text-sm text-red-600">{resetError}</p>}
                  {resetSuccess && <p className="text-sm font-medium text-green-700">{resetSuccess}</p>}

                  <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => setResetOpen(false)}
                        className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700"
                    >
                      Close
                    </button>
                    <button
                        type="submit"
                        disabled={resetLoading}
                        className="rounded-lg bg-[#001F3F] px-5 py-2 text-sm font-semibold text-white hover:bg-[#003366] disabled:opacity-60"
                    >
                      {resetLoading ? "Resetting..." : "Set New Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </main>
  );
}