// mailer.js
require("dotenv").config();
const axios = require("axios");
const sgMail = require("@sendgrid/mail");
const cron = require("node-cron");
const { EmailLog } = require("../models/AuditLog");

const {
  SENDGRID_API_KEY,
  MAIL_FROM,
  MAIL_TO,
  BASE_URL,
  APP_USER,
  APP_PASS,
  SESSION_SECRET,
} = process.env;

if (
  !SENDGRID_API_KEY ||
  !MAIL_FROM ||
  !MAIL_TO ||
  !BASE_URL ||
  !APP_USER ||
  !APP_PASS ||
  !SESSION_SECRET
) {
  console.error("❌ Please set all required ENV vars in .env");
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

function safe(val) {
  return (val ?? "").toString();
}

function htmlEscape(str) {
  return safe(str).replace(
    /[&<>"']/g,
    (s) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[s])
  );
}

function buildTable(rows, columns, title) {
  if (!rows.length) {
    return `<div style="font:13px/1.4 Calibri,Segoe UI,Roboto,Arial,sans-serif">
      <h3 style="margin:12px 0">${htmlEscape(title)}</h3>
      <div style="padding:8px 12px;background:#fff3cd;border:1px solid #ffe69c;border-radius:8px">
        No records.
      </div>
    </div>`;
  }

  const thead = columns
    .map(
      (
        c
      ) => `<th style="padding:6px 8px;border:1px solid #d1d5db;background:#e8f4ff;
        font-size:12px;font-weight:600;text-align:left;white-space:nowrap;">
        ${htmlEscape(c.label)}</th>`
    )
    .join("");

  const tbody = rows
    .map((r) => {
      const tds = columns
        .map(
          (c) => `<td style="padding:6px 8px;border:1px solid #d1d5db;
            font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            max-width:200px;">
            ${htmlEscape(
              typeof c.get === "function" ? c.get(r) : r[c.key]
            )}</td>`
        )
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `
  <div style="font:13px/1.4 Calibri,Segoe UI,Roboto,Arial,sans-serif;margin-top:12px">
    <h3 style="margin:12px 0">${htmlEscape(title)} 
      <span style="font-weight:normal;color:#6b7280">(${rows.length})</span>
    </h3>
    <div style="overflow:auto;border:1px solid #d1d5db;border-radius:6px">
      <table style="width:100%;border-collapse:collapse;min-width:860px;">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  </div>`;
}

function toCSV(rows, keys, headerMap) {
  const esc = (v) => {
    const s = safe(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = keys.map((k) => esc(headerMap[k] || k)).join(",");
  const lines = rows.map((r) => keys.map((k) => esc(r[k])).join(","));
  return [header, ...lines].join("\n");
}

function makeAttachment(filename, contentStr) {
  return {
    filename,
    content: Buffer.from(contentStr).toString("base64"),
    type: "text/csv",
    disposition: "attachment",
  };
}

// ---- Get fresh JWT ----
async function getFreshToken() {
  try {
    const res = await axios.post(`${BASE_URL}/login`, {
      username: APP_USER,
      password: APP_PASS,
    });
    return res.data.token;
  } catch (err) {
    console.error("❌ Error while login:", err.response?.data || err.message);
    throw err;
  }
}

// Example: Unverified email
async function sendUnverifiedEmail() {
  try {
    const token = await getFreshToken();
    // TODO: fetch your data (hpcl, jio)...

    const subject = `Unverified Status • Demo`;
    const html = `<p>Test Unverified Email</p>`;

    const csvDummy = "col1,col2\nval1,val2";

    const msg = {
      from: { email: MAIL_FROM, name: "no-reply" },
      to: MAIL_TO,
      subject,
      html,
      attachments: [makeAttachment("demo.csv", csvDummy)],
    };

    const [response] = await sgMail.send(msg);
    console.log("✅ Mail sent:", response.statusCode);

    await EmailLog.create({
      type: "Unverified Report",
      subject,
      to: MAIL_TO,
      status: "success",
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("❌ Mail error:", err.response?.body || err.message);
  }
}

// ---- Manual run ----
if (require.main === module) {
  sendUnverifiedEmail().catch((e) => {
    console.error("❌ Mail error:", e?.response?.body || e.message);
    process.exit(1);
  });
}
