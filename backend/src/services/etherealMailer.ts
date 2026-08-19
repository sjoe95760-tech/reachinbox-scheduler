import nodemailer, { Transporter } from "nodemailer";

// We cache one transporter per sender (by SMTP user) so we're not
// re-authenticating with Ethereal on every single email send.
const transporterCache = new Map<string, Transporter>();

export interface SenderCreds {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
}

function getTransporter(creds: SenderCreds): Transporter {
  const cacheKey = creds.smtpUser;
  if (transporterCache.has(cacheKey)) {
    return transporterCache.get(cacheKey)!;
  }

  const transporter = nodemailer.createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    secure: false, // Ethereal uses STARTTLS on 587, not implicit TLS
    auth: {
      user: creds.smtpUser,
      pass: creds.smtpPass,
    },
  });

  transporterCache.set(cacheKey, transporter);
  return transporter;
}

export async function sendEmailViaEthereal(params: {
  creds: SenderCreds;
  to: string;
  subject: string;
  html: string;
}) {
  const transporter = getTransporter(params.creds);

  const info = await transporter.sendMail({
    from: `"ReachInbox Scheduler" <${params.creds.smtpUser}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  // Ethereal gives you a shareable URL to view the "sent" email in a browser
  // - very handy for demoing in your submission video.
  const previewUrl = nodemailer.getTestMessageUrl(info);

  return { messageId: info.messageId, previewUrl };
}
