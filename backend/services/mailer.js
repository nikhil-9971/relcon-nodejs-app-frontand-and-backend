// mailer.js
require("dotenv").config();
const axios = require("axios");
const cron = require("node-cron");
const sgMail = require("@sendgrid/mail");
const { EmailLog } = require("../models/AuditLog");

// ---- ENV ----
const { SENDGRID_API_KEY, MAIL_FROM, MAIL_TO, BASE_URL, APP_USER, APP_PASS } =
  process.env;

if (
  !SENDGRID_API_KEY ||
  !MAIL_FROM ||
  !MAIL_TO ||
  !BASE_URL ||
  !APP_USER ||
  !APP_PASS
) {
  console.error("❌ Please set all required ENV vars in .env");
  process.exit(1);
}

// ---- Init SendGrid ----
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
        No unverified records.
      </div>
    </div>`;
  }

  const thead = columns
    .map(
      (c) =>
        `<th style="padding:6px 8px;border:1px solid #d1d5db;background:#e8f4ff;
        font-size:12px;font-weight:600;text-align:left;white-space:nowrap;">
        ${htmlEscape(c.label)}</th>`
    )
    .join("");

  const tbody = rows
    .map((r) => {
      const tds = columns
        .map(
          (c) =>
            `<td style="padding:6px 8px;border:1px solid #d1d5db;
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

// ---- Date helpers (IST) ----
function toIST(date) {
  const s = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(s);
}

function formatYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getLastWeekRangeIST() {
  const nowIST = toIST(new Date());
  const day = nowIST.getDay(); // 0=Sun,1=Mon,...
  const daysSinceMonday = (day + 6) % 7;
  const currentMonday = new Date(nowIST);
  currentMonday.setHours(0, 0, 0, 0);
  currentMonday.setDate(currentMonday.getDate() - daysSinceMonday);

  const lastMonday = new Date(currentMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  return {
    start: formatYYYYMMDD(lastMonday),
    end: formatYYYYMMDD(lastSunday),
    startDate: lastMonday,
    endDate: lastSunday,
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

// -------------------------
// ---- EMAIL HELPERS ------
// -------------------------
async function sendEmailWithAttachments({ subject, html, attachments }) {
  const msg = {
    from: MAIL_FROM,
    to: MAIL_TO,
    subject,
    html,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content).toString("base64"),
      type: "text/csv",
      disposition: "attachment",
    })),
  };

  const [response] = await sgMail.send(msg);
  console.log("✅ Mail sent:", response.statusCode);
  return response;
}

// -------------------------
// ---- Unverified Email ---
// -------------------------
async function fetchHPCLUnverified(token) {
  const url = `${BASE_URL}/getMergedStatusRecords`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (data || []).filter(
    (d) => d && (d.isVerified === false || d.isVerified === "false")
  );
}

async function fetchJioBPUnverified(token) {
  const url = `${BASE_URL}/jioBP/getAllJioBPStatus`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = (data || []).filter(
    (d) => d && (d.isVerified === false || d.isVerified === "false")
  );
  return rows.map((d) => ({
    ...d,
    engineer: d.planId?.engineer || d.engineer || "",
    region: d.planId?.region || d.region || "",
    roCode: d.planId?.roCode || d.roCode || "",
    roName: d.planId?.roName || d.roName || "",
    date: d.planId?.date || d.date || "",
    purpose: d.planId?.purpose || d.purpose || "",
  }));
}

async function sendUnverifiedEmail() {
  try {
    const token = await getFreshToken();
    const [hpcl, jio] = await Promise.all([
      fetchHPCLUnverified(token),
      fetchJioBPUnverified(token),
    ]);

    const subject = `Unverified Status • HPCL: ${hpcl.length} • JIO BP: ${jio.length}`;
    const intro = `
    <div style="font:14px/1.55 system-ui,Segoe UI,Roboto,Arial">
      <p>Dear Team,</p>
      <p>Please find <b>Unverified</b> record summary of HPCL & JIO BP Site. Please Check and verify Site Status</p>
    </div>`;

    const hpclTable = buildTable(
      hpcl,
      [
        { label: "Date", get: (r) => safe(r.date) },
        { label: "Engineer", get: (r) => safe(r.engineer) },
        { label: "Region", get: (r) => safe(r.region) },
        { label: "RO Code", get: (r) => safe(r.roCode) },
        { label: "RO Name", get: (r) => safe(r.roName) },
        { label: "Purpose", get: (r) => safe(r.purpose) },
        { label: "Work Completion Status", get: (r) => safe(r.workCompletion) },
      ],
      "HPCL — Unverified Status"
    );
    const jioTable = buildTable(
      jio,
      [
        { label: "Date", get: (r) => safe(r.date) },
        { label: "Engineer", get: (r) => safe(r.engineer) },
        { label: "Region", get: (r) => safe(r.region) },
        { label: "RO Code", get: (r) => safe(r.roCode) },
        { label: "RO Name", get: (r) => safe(r.roName) },
        { label: "Purpose", get: (r) => safe(r.purpose) },
        { label: "Status", get: (r) => safe(r.status) },
      ],
      "JIO BP — Unverified Status"
    );

    const html = `
    <div style="background:#f8fafc;padding:18px">
      <div style="max-width:1100px;margin:auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
        <h2 style="margin:0 0 12px 0;font:600 18px system-ui">Daily Unverified Report</h2>
        ${intro}
        ${hpclTable}
        ${jioTable}
        <p style="margin-top:16px;color:#64748b">— This is an automated email. Don't Reply</p>
      </div>
    </div>`;

    const hpclCSV = toCSV(
      hpcl,
      ["date", "engineer", "region", "roCode", "roName", "purpose"],
      {}
    );
    const jioCSV = toCSV(
      jio,
      ["date", "engineer", "region", "roCode", "roName", "purpose"],
      {}
    );

    await sendEmailWithAttachments({
      subject,
      html,
      attachments: [
        { filename: "HPCL_unverified.csv", content: hpclCSV },
        { filename: "JIO_BP_unverified.csv", content: jioCSV },
      ],
    });
  } catch (err) {
    console.error("❌ Mail error:", err.response?.data || err.message);
  }
}

// ---- Manual run (node mailer.js) ----
if (require.main === module) {
  sendUnverifiedEmail().catch((e) => {
    console.error("❌ Mail error:", e?.response?.data || e.message);
    process.exit(1);
  });
}

// ---- CRON SCHEDULES ----
// रोज़ाना सुबह 10:00 बजे IST
cron.schedule(
  "18 19 * * *",
  () => {
    console.log("⏰ Cron triggered:", new Date().toISOString());
    sendUnverifiedEmail();
  },
  { timezone: "Asia/Kolkata" }
);
