// mailer.js
require("dotenv").config();
const axios = require("axios");
//const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
const cron = require("node-cron");
const { EmailLog } = require("../models/AuditLog");

// ---- ENV ----
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

// ---- Email transport ----
// const transporter = nodemailer.createTransport({
//   host: SMTP_HOST,
//   port: Number(SMTP_PORT),
//   secure: Number(SMTP_PORT) === 465, // 465 => SSL
//   auth: { user: SMTP_USER, pass: SMTP_PASS },
// });

// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: Number(process.env.SMTP_PORT),
//   secure: false, // TLS (STARTTLS) use करेगा
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS,
//   },
// });

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
  // Convert a Date to an equivalent Date object in IST timezone
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
  // Find current week Monday (IST)
  const day = nowIST.getDay(); // 0=Sun,1=Mon,...
  const daysSinceMonday = (day + 6) % 7; // 0 if Mon
  const currentMonday = new Date(nowIST);
  currentMonday.setHours(0, 0, 0, 0);
  currentMonday.setDate(currentMonday.getDate() - daysSinceMonday);

  // Last week's Monday and Sunday
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

// ---- Fetchers ----
// HPCL unverified
async function fetchHPCLUnverified(token) {
  const url = `${BASE_URL}/getMergedStatusRecords`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = (data || []).filter(
    (d) => d && (d.isVerified === false || d.isVerified === "false")
  );
  return rows;
}

// JIO BP unverified
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
// ---- Build & Send Email ----

async function sendUnverifiedEmail() {
  try {
    const token = await getFreshToken(); // ✅ fresh token per run

    const [hpcl, jio] = await Promise.all([
      fetchHPCLUnverified(token),
      fetchJioBPUnverified(token),
    ]);

    const hpclCols = [
      { label: "Date", get: (r) => safe(r.date) },
      { label: "Engineer", get: (r) => safe(r.engineer) },
      { label: "Region", get: (r) => safe(r.region) },
      { label: "RO Code", get: (r) => safe(r.roCode) },
      { label: "RO Name", get: (r) => safe(r.roName) },
      { label: "Purpose", get: (r) => safe(r.purpose) },
      { label: "Work Completion Status", get: (r) => safe(r.workCompletion) },
    ];
    const jioCols = [
      { label: "Date", get: (r) => safe(r.date) },
      { label: "Engineer", get: (r) => safe(r.engineer) },
      { label: "Region", get: (r) => safe(r.region) },
      { label: "RO Code", get: (r) => safe(r.roCode) },
      { label: "RO Name", get: (r) => safe(r.roName) },
      { label: "Purpose", get: (r) => safe(r.purpose) },
      { label: "Status", get: (r) => safe(r.status) },
    ];

    const subject = `Unverified Status • HPCL: ${hpcl.length} • JIO BP: ${jio.length}_LUCKNOW, PATNA & BEGUSARAI`;
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
        <p style="margin-top:16px;color:#64748b">- Nikhil Trivedi </p>
        <p style="margin-top:16px;color:#64748b">— This is an automated email. Don't Reply</p>
      </div>
    </div>`;

    const hpclKeys = [
      "engineer",
      "region",
      "phase",
      "roCode",
      "roName",
      "date",
      "amcQtr",
      "purpose",
      "probeMake",
      "probeSize",
      "lowProductLock",
      "highWaterSet",
      "duSerialNumber",
      "dgStatus",
      "connectivityType",
      "sim1Provider",
      "sim1Number",
      "sim2Provider",
      "sim2Number",
      "iemiNumber",
      "bosVersion",
      "fccVersion",
      "wirelessSlave",
      "sftpConfig",
      "adminPassword",
      "workCompletion",
      "spareUsed",
      "activeSpare",
      "faultySpare",
      "spareRequirment",
      "spareRequirmentname",
      "earthingStatus",
      "voltageReading",
      "duOffline",
      "duDependency",
      "duRemark",
      "tankOffline",
      "tankDependency",
      "tankRemark",
      "locationField",
    ];

    const hpclHeaderMap = {
      engineer: "Engineer Name",
      region: "Region",
      phase: "Phase",
      roCode: "RO Code",
      roName: "RO Name",
      date: "Date",
      amcQtr: "AMC Qtr",
      purpose: "Purpose of Visit",
      probeMake: "Probe Make",
      probeSize: "Product & Probe Size",
      lowProductLock: "Low Product Lock",
      highWaterSet: "Highwater Lock Set",
      duSerialNumber: "DU Serial Number Updated",
      dgStatus: "DG Status",
      connectivityType: "Connectivity Type",
      sim1Provider: "SIM1 Provider",
      sim1Number: "SIM1 Number",
      sim2Provider: "SIM2 Provider",
      sim2Number: "SIM2 Number",
      iemiNumber: "IEMI Number",
      bosVersion: "BOS Version",
      fccVersion: "FCC Version",
      wirelessSlave: "Wireless Slave Version",
      sftpConfig: "SFTP Config",
      adminPassword: "Admin Password Updated",
      workCompletion: "Work Completion",
      spareUsed: "Any Spare Used",
      activeSpare: "Used Spare Name",
      faultySpare: "Faulty Spare Name & Code",
      spareRequirment: "Any Spare Requirement",
      spareRequirmentname: "Required Spare Name",
      earthingStatus: "Earthing Status",
      voltageReading: "Voltage Reading",
      duOffline: "DU Offline",
      duDependency: "DU Dependency",
      duRemark: "DU Remark",
      tankOffline: "Tank Offline",
      tankDependency: "Tank Dependency",
      tankRemark: "Tank Remark",
      locationField: "Location Field",
    };

    const hpclCSV = toCSV(hpcl, hpclKeys, hpclHeaderMap);

    const jioKeys = [
      "engineer",
      "region",
      "roCode",
      "roName",
      "purpose",
      "date",
      "hpsdId",
      "diagnosis",
      "solution",
      "activeMaterialUsed",
      "usedMaterialDetails",
      "faultyMaterialDetails",
      "spareRequired",
      "observationHours",
      "materialRequirement",
      "relconsupport",
      "rbmlperson",
      "status",
      "actions",
    ];

    const jioHeaderMap = {
      engineer: "Engineer",
      region: "Region",
      roCode: "RO Code",
      roName: "RO Name",
      purpose: "Purpose of Visit",
      date: "Date",
      hpsdId: "HPSM ID",
      diagnosis: "Diagnosis",
      solution: "Solution",
      activeMaterialUsed: "Active Material Used",
      usedMaterialDetails: "Used Material Name & Code",
      faultyMaterialDetails: "Faulty Material Name & Code",
      spareRequired: "Spare Requirement",
      observationHours: "Observation (in Hours)",
      materialRequirement: "Material Requirement Name",
      relconsupport: "Support Taken from RELCON Person",
      rbmlperson: "Inform to RBML Person",
      status: "Status",
      actions: "Actions",
    };

    const jioCSV = toCSV(jio, jioKeys, jioHeaderMap);

    const info = await sgMail.send({
      from: MAIL_FROM,
      to: MAIL_TO,
      subject,
      html,
      attachments: [
        { filename: "HPCL_unverified.csv", content: hpclCSV },
        { filename: "JIO_BP_unverified.csv", content: jioCSV },
      ],
    });

    console.log("✅ Mail sent:", info.messageId);
    // ✅ Log email success
    await EmailLog.create({
      type: "Daily Unverified Report",
      subject,
      to: MAIL_TO,
      status: "success",
      meta: { counts: { hpcl: hpcl.length, jio: jio.length } },
      sentAt: new Date(),
    });
  } catch (err) {
    console.error("❌ Mail error:", err.response?.data || err.message);
    // ❌ Log email failure
    try {
      await EmailLog.create({
        type: "Daily Unverified Report",
        subject: typeof subject !== "undefined" ? subject : "",
        to: MAIL_TO,
        status: "failure",
        error: err?.response?.data || err.message,
        sentAt: new Date(),
      });
    } catch (e) {
      // swallow logging error
    }
  }
}

// ---- Weekly Plan Report (excluding NO PLAN) ----
async function fetchAllPlans(token) {
  const url = `${BASE_URL}/getDailyPlans`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(data) ? data : [];
}

function normalizePurpose(p) {
  return safe(p).trim().toUpperCase();
}

function withinDateRange(planDateStr, startYYYYMMDD, endYYYYMMDD) {
  // Plan date is expected as YYYY-MM-DD; compare lexicographically
  const d = safe(planDateStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d >= startYYYYMMDD && d <= endYYYYMMDD;
}

async function sendWeeklyPlanEmail() {
  try {
    const token = await getFreshToken();
    const { start, end } = getLastWeekRangeIST();

    const plans = await fetchAllPlans(token);
    const filtered = plans
      .filter((p) => withinDateRange(p.date, start, end))
      .filter((p) => normalizePurpose(p.purpose) !== "NO PLAN");

    // Build distinct Issue Types
    const issueTypesSet = new Set();
    filtered.forEach((p) => {
      const t = (safe(p.issueType).trim() || "N/A").toUpperCase();
      issueTypesSet.add(t);
    });
    const issueTypes = Array.from(issueTypesSet).sort();

    // Aggregate by engineer
    const byEngineer = new Map();
    filtered.forEach((p) => {
      const engineerName = safe(p.engineer) || "UNKNOWN";
      const itype = (safe(p.issueType).trim() || "N/A").toUpperCase();
      if (!byEngineer.has(engineerName)) {
        byEngineer.set(engineerName, {
          engineer: engineerName,
          total: 0,
          issueCounts: {},
        });
      }
      const agg = byEngineer.get(engineerName);
      agg.total += 1;
      agg.issueCounts[itype] = (agg.issueCounts[itype] || 0) + 1;
    });

    const summaryRows = Array.from(byEngineer.values()).sort((a, b) =>
      a.engineer.toLowerCase() < b.engineer.toLowerCase() ? -1 : 1
    );

    const summaryCols = [
      { label: "Engineer", get: (r) => safe(r.engineer) },
      { label: "Total Visits", get: (r) => String(r.total) },
      ...issueTypes.map((t) => ({
        label: `Issue: ${t}`,
        get: (r) => String(r.issueCounts[t] || 0),
      })),
    ];

    const summaryTable = buildTable(
      summaryRows,
      summaryCols,
      `Weekly Plan Summary (${start} to ${end})`
    );
    const subject = `Weekly Plans Summary (${start} to ${end}) • Engineers: ${summaryRows.length} • Total Plans: ${filtered.length}`;

    // Include all relevant DailyPlan fields in CSV
    const csvKeys = [
      "zone",
      "region",
      "engineer",
      "phase",
      "roCode",
      "roName",
      "empId",
      "incidentId",
      "purpose",
      "issueType",
      "amcQtr",
      "date",
      "completionStatus",
      "arrivalTime",
      "leaveTime",
      "supportTakenFrom",
      "whatDone",
    ];
    const headerMap = {
      zone: "Zone",
      region: "Region",
      engineer: "Engineer",
      phase: "Phase",
      roCode: "RO Code",
      roName: "RO Name",
      empId: "Employee Id",
      incidentId: "Incident Id",
      purpose: "Purpose of Visit",
      issueType: "Issue Type",
      amcQtr: "AMC Qtr",
      date: "Date of Visit",
      completionStatus: "Completion Status",
      arrivalTime: "Arrival Time",
      leaveTime: "Leave Time",
      supportTakenFrom: "Support Taken From",
      whatDone: "What has to be done",
    };
    const csv = toCSV(filtered, csvKeys, headerMap);

    const html = `
    <div style="background:#f8fafc;padding:18px">
      <div style="max-width:1100px;margin:auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
        <h2 style="margin:0 0 12px 0;font:600 18px system-ui">Weekly Plan Summary</h2>
        <div style="font:14px/1.55 system-ui,Segoe UI,Roboto,Arial">
          <p>Dear Team,</p>
          <p>Please find a summary of last week's plans for all engineers (excluding <b>NO PLAN</b>) for the period <b>${htmlEscape(
            start
          )}</b> to <b>${htmlEscape(end)}</b>.</p>
        </div>
        ${summaryTable}
        <p style="margin-top:16px;color:#64748b">— This is an automated email. Don't Reply</p>
      </div>
    </div>`;

    const info = await sgMail.send({
      from: MAIL_FROM,
      to: MAIL_TO,
      subject,
      html,
      attachments: [
        { filename: `Weekly_Plans_${start}_to_${end}.csv`, content: csv },
      ],
    });

    console.log("✅ Weekly plan mail sent:", info.messageId);
    await EmailLog.create({
      type: "Weekly Plans Summary",
      subject,
      to: MAIL_TO,
      status: "success",
      meta: { range: { start, end }, totalPlans: filtered.length },
      sentAt: new Date(),
    });
  } catch (err) {
    console.error(
      "❌ Weekly plan mail error:",
      err.response?.data || err.message
    );
    try {
      await EmailLog.create({
        type: "Weekly Plans Summary",
        subject: typeof subject !== "undefined" ? subject : "",
        to: MAIL_TO,
        status: "failure",
        error: err?.response?.data || err.message,
        meta: { range: { start, end } },
        sentAt: new Date(),
      });
    } catch (_) {}
  }
}

// ---- Weekly HPCL/JIO Status Analysis ----
async function fetchHPCLAllStatuses(token) {
  const url = `${BASE_URL}/getMergedStatusRecords`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(data) ? data : [];
}

async function fetchJioBPAllStatuses(token) {
  const url = `${BASE_URL}/jioBP/getAllJioBPStatus`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const rows = Array.isArray(data) ? data : [];
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

function boolish(v) {
  if (typeof v === "boolean") return v;
  const s = safe(v).trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function analyzeStatuses(hpclRows, jioRows) {
  const perEngineer = new Map();
  const perRegion = new Map();

  function upsert(map, key, init) {
    if (!map.has(key)) map.set(key, init());
    return map.get(key);
  }

  // HPCL aggregation
  hpclRows.forEach((r) => {
    const engineer = safe(r.engineer) || "UNKNOWN";
    const region = safe(r.region) || "";
    const verified = boolish(r.isVerified);
    const issueType =
      (safe(r.issueType) || safe(r.purpose) || "").trim().toUpperCase() ||
      "N/A";

    const e = upsert(perEngineer, engineer, () => ({
      engineer,
      hpclVisits: 0,
      hpclVerified: 0,
      hpclUnverified: 0,
      jioVisits: 0,
      jioResolved: 0,
      jioUnresolved: 0,
      issues: {},
      regions: new Set(),
    }));
    e.hpclVisits += 1;
    e[verified ? "hpclVerified" : "hpclUnverified"] += 1;
    e.issues[issueType] = (e.issues[issueType] || 0) + 1;
    if (region) e.regions.add(region);

    const reg = upsert(perRegion, region || "N/A", () => ({
      region: region || "N/A",
      hpclVisits: 0,
      jioVisits: 0,
      engineers: new Set(),
    }));
    reg.hpclVisits += 1;
    if (engineer) reg.engineers.add(engineer);
  });

  // JIO aggregation
  jioRows.forEach((r) => {
    const engineer = safe(r.engineer) || "UNKNOWN";
    const region = safe(r.region) || "";
    const resolved = safe(r.status).toLowerCase() === "resolved";
    const issueType =
      (safe(r.diagnosis) || safe(r.purpose) || "").trim().toUpperCase() ||
      "N/A";

    const e = upsert(perEngineer, engineer, () => ({
      engineer,
      hpclVisits: 0,
      hpclVerified: 0,
      hpclUnverified: 0,
      jioVisits: 0,
      jioResolved: 0,
      jioUnresolved: 0,
      issues: {},
      regions: new Set(),
    }));
    e.jioVisits += 1;
    e[resolved ? "jioResolved" : "jioUnresolved"] += 1;
    e.issues[issueType] = (e.issues[issueType] || 0) + 1;
    if (region) e.regions.add(region);

    const reg = upsert(perRegion, region || "N/A", () => ({
      region: region || "N/A",
      hpclVisits: 0,
      jioVisits: 0,
      engineers: new Set(),
    }));
    reg.jioVisits += 1;
    if (engineer) reg.engineers.add(engineer);
  });

  const perEngineerRows = Array.from(perEngineer.values()).map((e) => ({
    engineer: e.engineer,
    hpclVisits: e.hpclVisits,
    hpclVerified: e.hpclVerified,
    hpclUnverified: e.hpclUnverified,
    jioVisits: e.jioVisits,
    jioResolved: e.jioResolved,
    jioUnresolved: e.jioUnresolved,
    totalVisits: e.hpclVisits + e.jioVisits,
    regions: Array.from(e.regions).join(", "),
  }));
  perEngineerRows.sort(
    (a, b) =>
      b.totalVisits - a.totalVisits || a.engineer.localeCompare(b.engineer)
  );

  const perRegionRows = Array.from(perRegion.values()).map((r) => ({
    region: r.region,
    hpclVisits: r.hpclVisits,
    jioVisits: r.jioVisits,
    totalVisits: r.hpclVisits + r.jioVisits,
    uniqueEngineers: r.engineers.size,
  }));
  perRegionRows.sort(
    (a, b) => b.totalVisits - a.totalVisits || a.region.localeCompare(b.region)
  );

  // Top issues overall (combine HPCL issueType and JIO diagnosis)
  const issueCounts = {};
  hpclRows.forEach((r) => {
    const t = (safe(r.issueType) || safe(r.purpose) || "N/A")
      .trim()
      .toUpperCase();
    issueCounts[t] = (issueCounts[t] || 0) + 1;
  });
  jioRows.forEach((r) => {
    const t = (safe(r.diagnosis) || safe(r.purpose) || "N/A")
      .trim()
      .toUpperCase();
    issueCounts[t] = (issueCounts[t] || 0) + 1;
  });
  const topIssues = Object.entries(issueCounts)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { perEngineerRows, perRegionRows, topIssues };
}

async function sendWeeklyStatusEmail() {
  try {
    const token = await getFreshToken();
    const { start, end } = getLastWeekRangeIST();

    const [hpclAll, jioAll] = await Promise.all([
      fetchHPCLAllStatuses(token),
      fetchJioBPAllStatuses(token),
    ]);

    const hpcl = hpclAll.filter((r) => withinDateRange(r.date, start, end));
    const jio = jioAll.filter((r) => withinDateRange(r.date, start, end));

    const { perEngineerRows, perRegionRows, topIssues } = analyzeStatuses(
      hpcl,
      jio
    );

    const perEngineerCols = [
      { label: "Engineer", get: (r) => safe(r.engineer) },
      { label: "HPCL Visits", get: (r) => String(r.hpclVisits) },
      { label: "HPCL Verified", get: (r) => String(r.hpclVerified) },
      { label: "HPCL Unverified", get: (r) => String(r.hpclUnverified) },
      { label: "JIO Visits", get: (r) => String(r.jioVisits) },
      { label: "JIO Resolved", get: (r) => String(r.jioResolved) },
      { label: "JIO Unresolved", get: (r) => String(r.jioUnresolved) },
      { label: "Total Visits", get: (r) => String(r.totalVisits) },
      { label: "Regions", get: (r) => safe(r.regions) },
    ];
    const perRegionCols = [
      { label: "Region", get: (r) => safe(r.region) },
      { label: "HPCL Visits", get: (r) => String(r.hpclVisits) },
      { label: "JIO Visits", get: (r) => String(r.jioVisits) },
      { label: "Total Visits", get: (r) => String(r.totalVisits) },
      { label: "Unique Engineers", get: (r) => String(r.uniqueEngineers) },
    ];
    const topIssuesCols = [
      { label: "Issue", get: (r) => safe(r.issue) },
      { label: "Count", get: (r) => String(r.count) },
    ];

    const perEngineerTable = buildTable(
      perEngineerRows,
      perEngineerCols,
      `Per‑Engineer Summary (${start} to ${end})`
    );
    const perRegionTable = buildTable(
      perRegionRows,
      perRegionCols,
      `Per‑Region Summary (${start} to ${end})`
    );
    const topIssuesTable = buildTable(
      topIssues,
      topIssuesCols,
      `Top Issues (${start} to ${end})`
    );

    const subject = `Weekly Site Status Analysis (HPCL & JIO BP) • ${start} to ${end}`;
    const html = `
    <div style="background:#f8fafc;padding:18px">
      <div style="max-width:1100px;margin:auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
        <h2 style="margin:0 0 12px 0;font:600 18px system-ui">Weekly Site Status Analysis</h2>
        <div style="font:14px/1.55 system-ui,Segoe UI,Roboto,Arial">
          <p>Dear Team,</p>
          <p>Here is the analyzed report for last week's HPCL and JIO BP site statuses.</p>
        </div>
        ${perEngineerTable}
        ${perRegionTable}
        ${topIssuesTable}
        <p style="margin-top:16px;color:#64748b">— This is an automated email. Don't Reply</p>
      </div>
    </div>`;

    // CSV attachments
    const engineerKeys = [
      "engineer",
      "hpclVisits",
      "hpclVerified",
      "hpclUnverified",
      "jioVisits",
      "jioResolved",
      "jioUnresolved",
      "totalVisits",
      "regions",
    ];
    const engineerHeader = {
      engineer: "Engineer",
      hpclVisits: "HPCL Visits",
      hpclVerified: "HPCL Verified",
      hpclUnverified: "HPCL Unverified",
      jioVisits: "JIO Visits",
      jioResolved: "JIO Resolved",
      jioUnresolved: "JIO Unresolved",
      totalVisits: "Total Visits",
      regions: "Regions",
    };
    const regionKeys = [
      "region",
      "hpclVisits",
      "jioVisits",
      "totalVisits",
      "uniqueEngineers",
    ];
    const regionHeader = {
      region: "Region",
      hpclVisits: "HPCL Visits",
      jioVisits: "JIO Visits",
      totalVisits: "Total Visits",
      uniqueEngineers: "Unique Engineers",
    };
    const topIssueKeys = ["issue", "count"];
    const topIssueHeader = { issue: "Issue", count: "Count" };

    const hpclDetailKeys = [
      "engineer",
      "region",
      "phase",
      "roCode",
      "roName",
      "date",
      "amcQtr",
      "purpose",
      "probeMake",
      "probeSize",
      "lowProductLock",
      "highWaterSet",
      "duSerialNumber",
      "dgStatus",
      "connectivityType",
      "sim1Provider",
      "sim1Number",
      "sim2Provider",
      "sim2Number",
      "iemiNumber",
      "bosVersion",
      "fccVersion",
      "wirelessSlave",
      "sftpConfig",
      "adminPassword",
      "workCompletion",
      "spareUsed",
      "activeSpare",
      "faultySpare",
      "spareRequirment",
      "spareRequirmentname",
      "earthingStatus",
      "voltageReading",
      "duOffline",
      "duDependency",
      "duRemark",
      "tankOffline",
      "tankDependency",
      "tankRemark",
      "locationField",
      "isVerified",
      "Verified",
      "Unverified",
    ];
    const hpclDetailHeader = {
      engineer: "Engineer",
      region: "Region",
      phase: "Phase",
      roCode: "RO Code",
      roName: "RO Name",
      date: "Date",
      amcQtr: "AMC Qtr",
      purpose: "Purpose of Visit",
      probeMake: "Probe Make",
      probeSize: "Product & Probe Size",
      lowProductLock: "Low Product Lock",
      highWaterSet: "Highwater Lock Set",
      duSerialNumber: "DU Serial Number Updated",
      dgStatus: "DG Status",
      connectivityType: "Connectivity Type",
      sim1Provider: "SIM1 Provider",
      sim1Number: "SIM1 Number",
      sim2Provider: "SIM2 Provider",
      sim2Number: "SIM2 Number",
      iemiNumber: "IEMI Number",
      bosVersion: "BOS Version",
      fccVersion: "FCC Version",
      wirelessSlave: "Wireless Slave Version",
      sftpConfig: "SFTP Config",
      adminPassword: "Admin Password Updated",
      workCompletion: "Work Completion",
      spareUsed: "Any Spare Used",
      activeSpare: "Used Spare Name",
      faultySpare: "Faulty Spare Name & Code",
      spareRequirment: "Any Spare Requirement",
      spareRequirmentname: "Required Spare Name",
      earthingStatus: "Earthing Status",
      voltageReading: "Voltage Reading",
      duOffline: "DU Offline",
      duDependency: "DU Dependency",
      duRemark: "DU Remark",
      tankOffline: "Tank Offline",
      tankDependency: "Tank Dependency",
      tankRemark: "Tank Remark",
      locationField: "Location Field",
      isVerified: "Verified Flag",
      Verified: "Verified",
      Unverified: "Unverified",
    };

    // JIO CSV: include all status fields + Verified/Unverified
    const jioDetailKeys = [
      "engineer",
      "region",
      "roCode",
      "roName",
      "purpose",
      "date",
      "hpsdId",
      "diagnosis",
      "solution",
      "activeMaterialUsed",
      "usedMaterialDetails",
      "faultyMaterialDetails",
      "spareRequired",
      "observationHours",
      "materialRequirement",
      "relconsupport",
      "rbmlperson",
      "status",
      "actions",
      "isVerified",
      "Verified",
      "Unverified",
    ];
    const jioDetailHeader = {
      engineer: "Engineer",
      region: "Region",
      roCode: "RO Code",
      roName: "RO Name",
      purpose: "Purpose",
      date: "Date",
      hpsdId: "HPSM ID",
      diagnosis: "Diagnosis",
      solution: "Solution",
      activeMaterialUsed: "Active Material Used",
      usedMaterialDetails: "Used Material Details",
      faultyMaterialDetails: "Faulty Material Details",
      spareRequired: "Spare Required",
      observationHours: "Observation Hours",
      materialRequirement: "Material Requirement",
      relconsupport: "RELCON Support Taken",
      rbmlperson: "Informed RBML Person",
      status: "Status",
      actions: "Actions",
      isVerified: "Verified Flag",
      Verified: "Verified",
      Unverified: "Unverified",
    };

    const attachments = [
      {
        filename: `Summary_PerEngineer_${start}_to_${end}.csv`,
        content: toCSV(perEngineerRows, engineerKeys, engineerHeader),
      },
      {
        filename: `Summary_PerRegion_${start}_to_${end}.csv`,
        content: toCSV(perRegionRows, regionKeys, regionHeader),
      },
      {
        filename: `Top_Issues_${start}_to_${end}.csv`,
        content: toCSV(topIssues, topIssueKeys, topIssueHeader),
      },
      {
        filename: `HPCL_Detail_${start}_to_${end}.csv`,
        content: toCSV(
          hpcl.map((r) => ({
            ...r,
            Verified: boolish(r.isVerified) ? "Yes" : "No",
            Unverified: boolish(r.isVerified) ? "No" : "Yes",
          })),
          hpclDetailKeys,
          hpclDetailHeader
        ),
      },
      {
        filename: `JIO_Detail_${start}_to_${end}.csv`,
        content: toCSV(
          jio.map((r) => ({
            ...r,
            Verified: boolish(r.isVerified) ? "Yes" : "No",
            Unverified: boolish(r.isVerified) ? "No" : "Yes",
          })),
          jioDetailKeys,
          jioDetailHeader
        ),
      },
    ];

    const info = await sgMail.send({
      from: MAIL_FROM,
      to: MAIL_TO,
      subject,
      html,
      attachments,
    });

    console.log("✅ Weekly status analysis mail sent:", info.messageId);
    await EmailLog.create({
      type: "Weekly Status Analysis",
      subject,
      to: MAIL_TO,
      status: "success",
      meta: {
        range: { start, end },
        hpclCount: hpcl.length,
        jioCount: jio.length,
      },
      sentAt: new Date(),
    });
  } catch (err) {
    console.error(
      "❌ Weekly status analysis error:",
      err.response?.data || err.message
    );
    try {
      await EmailLog.create({
        type: "Weekly Status Analysis",
        subject: typeof subject !== "undefined" ? subject : "",
        to: MAIL_TO,
        status: "failure",
        error: err?.response?.data || err.message,
        meta: { range: { start, end } },
        sentAt: new Date(),
      });
    } catch (_) {}
  }
}

// ---- Manual run (node mailer.js) ----
if (require.main === module) {
  sendUnverifiedEmail().catch((e) => {
    console.error("❌ Mail error:", e?.response?.data || e.message);
    process.exit(1);
  });
}

// ---- CRON (auto) ----
// रोज़ाना सुबह 10:00 बजे IST
const CRON_SCHEDULE = "38 22 * * *";
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

// हर सोमवार 11:00 बजे IST - साप्ताहिक प्लान रिपोर्ट
const WEEKLY_CRON_SCHEDULE = "25 10 * * *"; // 1 = Monday
cron.schedule(
  WEEKLY_CRON_SCHEDULE,
  () => {
    console.log("⏰ Weekly cron triggered:", new Date().toISOString());
    sendWeeklyPlanEmail().catch((e) =>
      console.error(
        "❌ Weekly plan cron error:",
        e?.response?.data || e.message
      )
    );
    // Also send status analysis
    // Move to 12:30 PM IST as per request
  },
  { timezone: "Asia/Kolkata" }
);

// हर सोमवार 12:30 बजे IST - साप्ताहिक स्टेटस एनालिसिस रिपोर्ट (HPCL & JIO)
const WEEKLY_STATUS_CRON = "30 12 * * 1"; // Monday 12:30
cron.schedule(
  WEEKLY_STATUS_CRON,
  () => {
    console.log("⏰ Weekly status cron triggered:", new Date().toISOString());
    sendWeeklyStatusEmail().catch((e) =>
      console.error(
        "❌ Weekly status cron error:",
        e?.response?.data || e.message
      )
    );
  },
  { timezone: "Asia/Kolkata" }
);
