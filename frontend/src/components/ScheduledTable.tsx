"use client";

import { useEffect, useState } from "react";
import { fetchScheduledEmails, ScheduledEmail } from "@/lib/api";

export default function ScheduledTable({ refreshKey }: { refreshKey: number }) {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchScheduledEmails();
        if (!cancelled) setEmails(data);
      } catch (err) {
        if (!cancelled) setError("Failed to load scheduled emails.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
        Loading scheduled emails...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-10 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">
        No scheduled emails yet. Click &quot;Compose New Email&quot; to
        schedule your first campaign.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">Scheduled Time</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {emails.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 text-gray-900">{e.email}</td>
              <td className="px-4 py-3 text-gray-700">{e.subject}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(e.scheduledFor).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={e.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-600",
    SCHEDULED: "bg-blue-100 text-blue-700",
    RATE_LIMITED: "bg-amber-100 text-amber-700",
  };

  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full ${
        styles[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {status.replace("_", " ").toLowerCase()}
    </span>
  );
}