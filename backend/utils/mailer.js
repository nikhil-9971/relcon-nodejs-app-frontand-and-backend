const nodemailer = require("nodemailer");

function buildTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[mailer] SMTP credentials missing. Skipping email send.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendEmailWithAttachments({ to, subject, text, attachments }) {
  const transporter = buildTransporter();
  if (!transporter) return { skipped: true, reason: "missing smtp" };

  const from = process.env.REPORT_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    attachments,
  });
  return { messageId: info.messageId };
}

module.exports = { sendEmailWithAttachments };