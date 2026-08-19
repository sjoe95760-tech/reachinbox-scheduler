"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { setAuthToken } from "@/lib/api";
import ScheduledTable from "@/components/ScheduledTable";
import SentTable from "@/components/SentTable";
import ComposeModal from "@/components/ComposeModal";

type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("scheduled");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (token) setAuthToken(token);
  }, [token]);

  function handleLogout() {
    logout();
    setAuthToken(null);
    router.push("/");
  }

  // Called after a campaign is successfully scheduled, to refresh tables
  function handleScheduled() {
    setIsComposeOpen(false);
    setActiveTab("scheduled");
    setRefreshKey((k) => k + 1);
  }

  if (isLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">
          ReachInbox Scheduler
        </h1>
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full"
            />
          )}
          <div className="text-sm text-right">
            <div className="font-medium text-gray-900">{user.name}</div>
            <div className="text-gray-500">{user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="ml-3 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg px-3 py-1.5"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <TabButton
              label="Scheduled Emails"
              active={activeTab === "scheduled"}
              onClick={() => setActiveTab("scheduled")}
            />
            <TabButton
              label="Sent Emails"
              active={activeTab === "sent"}
              onClick={() => setActiveTab("sent")}
            />
          </div>

          <button
            onClick={() => setIsComposeOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Compose New Email
          </button>
        </div>

        {activeTab === "scheduled" ? (
          <ScheduledTable refreshKey={refreshKey} />
        ) : (
          <SentTable refreshKey={refreshKey} />
        )}
      </div>

      {isComposeOpen && (
        <ComposeModal
          onClose={() => setIsComposeOpen(false)}
          onScheduled={handleScheduled}
        />
      )}
    </main>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm font-medium px-4 py-2 rounded-lg ${
        active
          ? "bg-gray-900 text-white"
          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}