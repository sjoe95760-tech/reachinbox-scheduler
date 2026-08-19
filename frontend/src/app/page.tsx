"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { api, setAuthToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading } = useAuth();

  // If already logged in, skip straight to the dashboard
  useEffect(() => {
    if (!isLoading && user) {
      router.push("/dashboard");
    }
  }, [isLoading, user, router]);

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return;

    try {
      const res = await api.post("/api/auth/google", {
        credential: credentialResponse.credential,
      });

      const { token, user: loggedInUser } = res.data;
      setAuthToken(token);
      login(token, loggedInUser);
      router.push("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
      alert("Login failed. Please try again.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-md p-10 max-w-sm w-full text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          ReachInbox Scheduler
        </h1>
        <p className="text-gray-500 mb-8">
          Sign in to schedule and track your email campaigns.
        </p>

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => alert("Google login failed")}
          />
        </div>
      </div>
    </main>
  );
}