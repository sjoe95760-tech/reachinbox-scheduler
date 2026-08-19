"use client";

import { useEffect, useState } from "react";
import { fetchSentEmails, SentEmail } from "@/lib/api";

export default function SentTable({ refreshKey }: { refreshKey: number }) {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchSentEmails();
        if (!cancelled) setEmails(data);
      } catch (err) {
        if (!cancelled) setError("Failed to load sent emails.");
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
        Loading sent emails...
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
        No emails sent yet.
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
            <th className="px-4 py-3 font-medium">Sent Time</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {emails.map((e) => (
            <tr key={e.id}>
              <td className="px-4 py-3 text-gray-900">{e.email}</td>
              <td className="px-4 py-3 text-gray-700">{e.subject}</td>
              <td className="px-4 py-3 text-gray-500">
                {e.sentAt ? new Date(e.sentAt).toLocaleString() : "-"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    e.status === "sent"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {e.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}