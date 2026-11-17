import { auth } from "@/lib/firebase";

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  return fetch(input, { cache: "no-store", ...init, headers });
}
