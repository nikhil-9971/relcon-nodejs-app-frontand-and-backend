// mailer.js
require("dotenv").config();
const axios = require("axios");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

// ---- ENV ----
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO,
  BASE_URL,
  JWT_TOKEN,
} = process.env;

if (
  !SMTP_HOST ||
  !SMTP_PORT ||
  !SMTP_USER ||
  !SMTP_PASS ||
  !MAIL_FROM ||
  !MAIL_TO ||
  !BASE_URL ||
  !JWT_TOKEN
) {
  console.error("❌ Please set all required ENV vars in .env");
  process.exit(1);
}

// ---- Email transport ----
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465, // 465 => SSL
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// ---- Helpers ----
const bearerHeaders = {
  Authorization: `Bearer ${JWT_TOKEN}`,
};

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
    return `<div style="font:14px/1.5 system-ui,Segoe UI,Roboto,Arial">
      <h3 style="margin:16px 0">${htmlEscape(title)}</h3>
      <div style="padding:8px 12px;background:#fff3cd;border:1px solid #ffe69c;border-radius:8px">
        No unverified records.
      </div>
    </div>`;
  }

  const thead = columns
    .map(
      (c) =>
        `<th style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;background:#f3f4f6">${htmlEscape(
          c.label
        )}</th>`
    )
    .join("");

  const tbody = rows
    .map((r) => {
      const tds = columns
        .map(
          (c) =>
            `<td style="padding:8px 10px;border-bottom:1px solid #f1f5f9">${htmlEscape(
              c.get(r)
            )}</td>`
        )
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `
  <div style="font:14px/1.5 system-ui,Segoe UI,Roboto,Arial;margin-top:16px">
    <h3 style="margin:16px 0">${htmlEscape(
      title
    )} <span style="font-weight:normal;color:#6b7280">(${
    rows.length
  })</span></h3>
    <div style="overflow:auto;border:1px solid #e5e7eb;border-radius:10px">
      <table style="width:100%;border-collapse:collapse;min-width:860px">${`<thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>`}</table>
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

// ---- Fetchers ----
// HPCL unverified
async function fetchHPCLUnverified() {
  const url = `${BASE_URL}/getMergedStatusRecords`;
  const { data } = await axios.get(url, { headers: bearerHeaders });
  const rows = (data || []).filter(
    (d) => d && (d.isVerified === false || d.isVerified === "false")
  );
  return rows;
}

// JIO BP unverified
async function fetchJioBPUnverified() {
  const url = `${BASE_URL}/jioBP/getAllJioBPStatus`;
  const { data } = await axios.get(url, { headers: bearerHeaders });
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
  }));
}

// ---- Build & Send Email ----
async function sendUnverifiedEmail() {
  // 1) Fetch
  const [hpcl, jio] = await Promise.all([
    fetchHPCLUnverified(),
    fetchJioBPUnverified(),
  ]);

  // 2) Columns
  const hpclCols = [
    { label: "Date", get: (r) => safe(r.date) },
    { label: "Engineer", get: (r) => safe(r.engineer) },
    { label: "Region", get: (r) => safe(r.region) },
    { label: "RO Code", get: (r) => safe(r.roCode) },
    { label: "RO Name", get: (r) => safe(r.roName) },
    { label: "DU Offline", get: (r) => safe(r.duOffline) },
    { label: "DU Dependency", get: (r) => safe(r.duDependency) },
    { label: "Tank Offline", get: (r) => safe(r.tankOffline) },
    { label: "Tank Dependency", get: (r) => safe(r.tankDependency) },
    { label: "Earthing Status", get: (r) => safe(r.earthingStatus) },
  ];

  const jioCols = [
    { label: "Date", get: (r) => safe(r.date) },
    { label: "Engineer", get: (r) => safe(r.engineer) },
    { label: "Region", get: (r) => safe(r.region) },
    { label: "RO Code", get: (r) => safe(r.roCode) },
    { label: "RO Name", get: (r) => safe(r.roName) },
    { label: "Purpose", get: (r) => safe(r.purpose) },
    { label: "Diagnosis", get: (r) => safe(r.diagnosis) },
    { label: "Solution", get: (r) => safe(r.solution) },
    { label: "Spare Required", get: (r) => safe(r.spareRequired) },
  ];

  // 3) HTML
  const subject = `Unverified Status • HPCL: ${hpcl.length} • JIO BP: ${jio.length}`;
  const intro = `
    <div style="font:14px/1.55 system-ui,Segoe UI,Roboto,Arial">
      <p>Dear Team,</p>
      <p>Please find <b>Unverified</b> record summary of HPCL & JIO BP Site. Please Check and verify Site Status</p>
    </div>`;

  const hpclTable = buildTable(hpcl, hpclCols, "HPCL — Unverified Status");
  const jioTable = buildTable(jio, jioCols, "JIO BP — Unverified Status");

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

  // 4) Attach CSVs
  const hpclKeys = [
    "date",
    "engineer",
    "region",
    "roCode",
    "roName",
    "duOffline",
    "duDependency",
    "tankOffline",
    "tankDependency",
    "earthingStatus",
  ];
  const hpclHeaderMap = {
    date: "Date",
    engineer: "Engineer",
    region: "Region",
    roCode: "RO Code",
    roName: "RO Name",
    duOffline: "DU Offline",
    duDependency: "DU Dependency",
    tankOffline: "Tank Offline",
    tankDependency: "Tank Dependency",
    earthingStatus: "Earthing Status",
  };
  const hpclCSV = toCSV(hpcl, hpclKeys, hpclHeaderMap);

  const jioKeys = [
    "date",
    "engineer",
    "region",
    "roCode",
    "roName",
    "purpose",
    "diagnosis",
    "solution",
    "spareRequired",
  ];
  const jioHeaderMap = {
    date: "Date",
    engineer: "Engineer",
    region: "Region",
    roCode: "RO Code",
    roName: "RO Name",
    purpose: "Purpose",
    diagnosis: "Diagnosis",
    solution: "Solution",
    spareRequired: "Spare Required",
  };
  const jioCSV = toCSV(jio, jioKeys, jioHeaderMap);

  // 5) Send
  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: MAIL_TO, // comma-separated list in .env
    subject,
    html,
    attachments: [
      { filename: "HPCL_unverified.csv", content: hpclCSV },
      { filename: "JIO BP_unverified.csv", content: jioCSV },
    ],
  });

  console.log("✅ Mail sent:", info.messageId);
}

// ---- Manual run (node mailer.js) ----
if (require.main === module) {
  sendUnverifiedEmail().catch((e) => {
    console.error("❌ Mail error:", e?.response?.data || e.message);
    process.exit(1);
  });
}

// ---- CRON (auto) ----
// रोज़ाना सुबह 9:00 बजे IST
const CRON_SCHEDULE = "45 21 * * *";
cron.schedule(
  CRON_SCHEDULE,
  () => {
    console.log("⏰ Cron triggered:", new Date().toISOString());
    sendUnverifiedEmail().catch((e) =>
      console.error("❌ Cron mail error:", e?.response?.data || e.message)
    );
  },
  { timezone: "Asia/Kolkata" }
);
