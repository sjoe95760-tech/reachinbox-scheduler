import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

export interface ScheduledEmail {
  id: string;
  email: string;
  subject: string;
  scheduledFor: string;
  status: string;
}

export interface SentEmail {
  id: string;
  email: string;
  subject: string;
  sentAt: string | null;
  status: string;
}

export async function fetchScheduledEmails(): Promise<ScheduledEmail[]> {
  const res = await api.get("/api/campaigns/scheduled");
  return res.data;
}

export async function fetchSentEmails(): Promise<SentEmail[]> {
  const res = await api.get("/api/campaigns/sent");
  return res.data;
}

export interface ScheduleCampaignParams {
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  leadsFile: File;
}

export async function scheduleCampaign(params: ScheduleCampaignParams) {
  const formData = new FormData();
  formData.append("subject", params.subject);
  formData.append("body", params.body);
  formData.append("startTime", params.startTime);
  formData.append(
    "delayBetweenEmailsMs",
    String(params.delayBetweenEmailsMs)
  );
  formData.append("hourlyLimit", String(params.hourlyLimit));
  formData.append("leadsFile", params.leadsFile);

  const res = await api.post("/api/campaigns", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}