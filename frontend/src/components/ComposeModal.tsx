"use client";

import { useState } from "react";
import { scheduleCampaign } from "@/lib/api";

export default function ComposeModal({
  onClose,
  onScheduled,
}: {
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [file, setFile] = useState<File | null>(null);
  const [detectedCount, setDetectedCount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    setDetectedCount(null);

    if (!selected) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const matches = text.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/g) || [];
      const unique = new Set(matches.map((m) => m.toLowerCase()));
      setDetectedCount(unique.size);
    };
    reader.readAsText(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please upload a CSV/text file of leads.");
      return;
    }
    if (!subject || !body || !startTime) {
      setError("Subject, body, and start time are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await scheduleCampaign({
        subject,
        body,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmailsMs: delayMs,
        hourlyLimit,
        leadsFile: file,
      });
      onScheduled();
    } catch (err) {
      console.error(err);
      setError("Failed to schedule campaign. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Compose New Email
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="input"
              placeholder="Your subject line"
            />
          </Field>

          <Field label="Body">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input min-h-[100px]"
              placeholder="Email content (HTML supported)"
            />
          </Field>

          <Field label="Leads file (CSV or TXT)">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="text-sm"
            />
            {detectedCount !== null && (
              <p className="text-xs text-gray-500 mt-1">
                {detectedCount} email address{detectedCount === 1 ? "" : "es"}{" "}
                detected
              </p>
            )}
          </Field>

          <Field label="Start time">
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Delay between emails (ms)">
              <input
                type="number"
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
                className="input"
                min={0}
              />
            </Field>
            <Field label="Hourly limit">
              <input
                type="number"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="input"
                min={1}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
            >
              {isSubmitting ? "Scheduling..." : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}