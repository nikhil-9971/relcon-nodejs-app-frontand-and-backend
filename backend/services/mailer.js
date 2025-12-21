/**
 * mailer.js
 * - Only sends daily "Pending Status (HPCL + RBML)" CSV to configured recipient via Gmail SMTP.
 * - Uses app-login to backend to fetch plans/status and compute pending records for YESTERDAY (default).
 * - Uses node-cron to run daily at 14:30 server local time (adjust cron if needed).
 *
 * Notes:
 * - This version uses nodemailer + Gmail SMTP (no SendGrid).
 * - Ensure you set SMTP_USER to your Gmail address and SMTP_PASS to an App Password (Gmail 2FA).
 * - Do NOT commit real .env secrets to repo.
 */
require("dotenv").config();
const axios = require("axios");
const nodemailer = require("nodemailer");
const cron = require("node-cron");
const { EmailLog } = require("../models/AuditLog");

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO,
  BASE_URL,
  APP_USER,
  APP_PASS,
  SESSION_SECRET,
} = process.env;

if (
  !SMTP_HOST ||
  !SMTP_PORT ||
  !SMTP_USER ||
  !SMTP_PASS ||
  !MAIL_FROM ||
  !MAIL_TO ||
  !BASE_URL ||
  !APP_USER ||
  !APP_PASS ||
  !SESSION_SECRET
) {
  console.error(
    "❌ Please set required ENV vars (SMTP_HOST,SMTP_PORT,SMTP_USER,SMTP_PASS,MAIL_FROM,MAIL_TO,BASE_URL,APP_USER,APP_PASS,SESSION_SECRET)"
  );
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465, // true for 465, false for other ports (587)
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

function safe(val) {
  return (val ?? "").toString();
}
function htmlEscape(str) {
  return safe(str).replace(
    /[&<>"']/g,
    (s) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        s
      ])
  );
}

function buildTable(rows, columns, title) {
  if (!rows.length) {
    return `<div style="font:13px/1.4 Calibri,Segoe UI,Roboto,Arial,sans-serif">
      <h3 style="margin:12px 0">${htmlEscape(title)}</h3>
      <div style="padding:8px 12px;background:#fff3cd;border:1px solid #ffe69c;border-radius:8px">No records.</div>
    </div>`;
  }

  const thead = columns
    .map(
      (c) =>
        `<th style="padding:6px 8px;border:1px solid #d1d5db;background:#e8f4ff;font-size:12px;font-weight:600;text-align:left;white-space:nowrap;">${htmlEscape(
          c.label
        )}</th>`
    )
    .join("");

  const tbody = rows
    .map((r) => {
      const tds = columns
        .map(
          (c) =>
            `<td style="padding:6px 8px;border:1px solid #d1d5db;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${htmlEscape(
              typeof c.get === "function" ? c.get(r) : r[c.key]
            )}</td>`
        )
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `
  <div style="font:13px/1.4 Calibri,Segoe UI,Roboto,Arial,sans-serif;margin-top:12px">
    <h3 style="margin:12px 0">${htmlEscape(
      title
    )} <span style="font-weight:normal;color:#6b7280">(${
    rows.length
  })</span></h3>
    <div style="overflow:auto;border:1px solid #d1d5db;border-radius:6px">
      <table style="width:100%;border-collapse:collapse;min-width:860px;">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
  </div>`;
}

function toCSV(rows, keys, headerMap = {}) {
  const esc = (v) => {
    const s = safe(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = keys.map((k) => esc(headerMap[k] || k)).join(",");
  const lines = rows.map((r) => keys.map((k) => esc(r[k])).join(","));
  return [header, ...lines].join("\n");
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

// Compute pending plans for a specific date (dateISO format 'YYYY-MM-DD')
function computePending(plans = [], hpcl = [], jio = [], targetDateISO) {
  const key = (rc, d) =>
    `${String(rc || "")
      .trim()
      .toUpperCase()}-${String(d || "").slice(0, 10)}`;

  const plansOnDate = (plans || []).filter((p) => {
    const pd = String(p.date || "").slice(0, 10);
    if (!pd) return false;
    const purpose = String(p.purpose || "")
      .trim()
      .toUpperCase();
    if (purpose === "NO PLAN" || purpose === "IN LEAVE") return false;
    return pd === targetDateISO;
  });

  const plansHpcl = plansOnDate.filter((p) =>
    String(p.phase || "")
      .toUpperCase()
      .startsWith("HPCL")
  );
  const plansRbml = plansOnDate.filter((p) =>
    String(p.phase || "")
      .toUpperCase()
      .includes("RBML")
  );

  const hpclStatusSet = new Set(
    (hpcl || [])
      .filter(
        (r) =>
          String(r.date || r.uploadDate || "").slice(0, 10) === targetDateISO
      )
      .filter((r) =>
        String(r.phase || "")
          .toUpperCase()
          .startsWith("HPCL")
      )
      .map((r) => key(r.roCode, r.date || r.uploadDate))
  );

  const rbmlStatusSet = new Set(
    (jio || [])
      .filter((r) => {
        const statusDate = String(
          r.date || r.uploadDate || r.planId?.date || ""
        ).slice(0, 10);
        return statusDate === targetDateISO;
      })
      .map((r) => {
        const ro = (r.roCode || r.siteCode || r.ro || r.planId?.roCode || "")
          .trim()
          .toUpperCase();
        const dt = String(r.date || r.uploadDate || r.planId?.date || "").slice(
          0,
          10
        );
        return key(ro, dt);
      })
  );

  const pendingHpcl = plansHpcl.filter(
    (p) => !hpclStatusSet.has(key(p.roCode, p.date))
  );
  const pendingRbml = plansRbml.filter(
    (p) => !rbmlStatusSet.has(key(p.roCode || p.siteCode || p.ro, p.date))
  );

  const rows = [
    ...pendingHpcl.map((p) => ({
      customer: "HPCL",
      date: String(p.date || "").slice(0, 10),
      roCode: p.roCode || p.siteCode || p.ro || "",
      roName: p.roName || "",
      region: p.region || "",
      engineer: p.engineer || "",
      phase: p.phase || "",
      purpose: p.purpose || "",
    })),
    ...pendingRbml.map((p) => ({
      customer: "RBML",
      date: String(p.date || "").slice(0, 10),
      roCode: p.roCode || p.siteCode || p.ro || "",
      roName: p.roName || "",
      region: p.region || "",
      engineer: p.engineer || "",
      phase: p.phase || "",
      purpose: p.purpose || "",
    })),
  ];

  return {
    rows,
    counts: {
      hpcl: pendingHpcl.length,
      rbml: pendingRbml.length,
      total: rows.length,
    },
  };
}

// ---- Send Pending Status Email ----
async function sendPendingStatusEmail({ forDateISO } = {}) {
  try {
    const token = await getFreshToken();

    const [plansRes, hpclRes, jioRes] = await Promise.all([
      axios.get(`${BASE_URL}/getDailyPlans`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${BASE_URL}/getMergedStatusRecords`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${BASE_URL}/jioBP/getAllJioBPStatus`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const plans = Array.isArray(plansRes.data) ? plansRes.data : [];
    const hpcl = Array.isArray(hpclRes.data) ? hpclRes.data : [];
    const jio = Array.isArray(jioRes.data) ? jioRes.data : [];

    const dateObj = forDateISO
      ? new Date(forDateISO + "T00:00:00")
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return d;
        })();
    const targetDateISO = dateObj.toISOString().slice(0, 10);

    const { rows, counts } = computePending(plans, hpcl, jio, targetDateISO);

    const keys = [
      "customer",
      "date",
      "roCode",
      "roName",
      "region",
      "engineer",
      "phase",
      "purpose",
    ];
    const headerMap = {
      customer: "Customer",
      date: "Date",
      roCode: "RO Code",
      roName: "RO Name",
      region: "Region",
      engineer: "Engineer",
      phase: "Phase",
      purpose: "Purpose",
    };
    const csv = toCSV(rows, keys, headerMap);

    const columns = keys.map((k) => ({ key: k, label: headerMap[k] }));
    const htmlBody = `
      <div style="font:14px/1.5 Calibri,Segoe UI,Roboto,Arial,sans-serif">
        <h2 style="margin-bottom:6px">Pending Status Report (HPCL + RBML)</h2>
        <p style="margin:6px 0;color:#374151">Date: <strong>${targetDateISO}</strong></p>
        <p style="margin:6px 0;color:#374151">Total pending: <strong>${
          counts.total
        }</strong> • HPCL: <strong>${counts.hpcl}</strong> • RBML: <strong>${
      counts.rbml
    }</strong></p>
        ${buildTable(
          rows.slice(0, 500),
          columns,
          "Pending Records (first 500 shown)"
        )}
        <p style="margin-top:10px;color:#6b7280;font-size:12px">This is an automated email. Full CSV is attached.</p>
      </div>
    `;

    const subject = `Pending Status Report • ${targetDateISO} • Total ${counts.total}`;

    const mailOptions = {
      from: MAIL_FROM,
      to: MAIL_TO,
      subject,
      html: htmlBody,
      attachments: [
        { filename: `pending_status_${targetDateISO}.csv`, content: csv },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Pending mail sent:", info.messageId);

    await EmailLog.create({
      type: "Pending Status Report",
      subject,
      to: MAIL_TO,
      status: "success",
      sentAt: new Date(),
      meta: {
        date: targetDateISO,
        total: counts.total,
        messageId: info.messageId,
      },
    });

    return { ok: true, counts };
  } catch (err) {
    console.error(
      "❌ sendPendingStatusEmail error:",
      err?.response?.data || err.message || err
    );
    try {
      await EmailLog.create({
        type: "Pending Status Report",
        subject: `Pending Status Report - failure`,
        to: MAIL_TO,
        status: "error",
        sentAt: new Date(),
        meta: {
          error: (err?.response?.data || err.message || String(err)).toString(),
        },
      });
    } catch (e) {
      console.error("❌ Failed to write EmailLog:", e);
    }
    return { ok: false, error: err };
  }
}

// Schedule: run daily at 14:30 server local time
// Cron expression below: "30 14 * * *" -> At 14:30 every day (server local timezone)
cron.schedule("35 14 * * *", () => {
  console.log(
    "🔔 Running scheduled pending-status mail job:",
    new Date().toLocaleString()
  );
  sendPendingStatusEmail().catch((e) =>
    console.error("Scheduled job error:", e)
  );
});

// Manual run support
if (require.main === module) {
  const dateArg = process.argv[2]; // optional YYYY-MM-DD
  sendPendingStatusEmail({ forDateISO: dateArg })
    .then((r) => {
      console.log("Done:", r);
      process.exit(r.ok ? 0 : 1);
    })
    .catch((e) => {
      console.error("❌ error:", e);
      process.exit(1);
    });
}

module.exports = { sendPendingStatusEmail };
