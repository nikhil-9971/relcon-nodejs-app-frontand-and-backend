const XLSX = require("xlsx");
const Status = require("../models/Status");
const JioBPStatus = require("../models/jioBPStatus");

function buildSheetFromRows(sheetName, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  // Autosize columns by computing max length
  const colWidths = [];
  rows.forEach((row) => {
    Object.values(row).forEach((val, idx) => {
      const len = String(val ?? "").length;
      colWidths[idx] = Math.max(colWidths[idx] || 10, len + 2);
    });
  });
  ws["!cols"] = (colWidths || []).map((wch) => ({ wch }));
  return { name: sheetName, ws };
}

async function fetchPendingVerifyStatusRows() {
  const records = await Status.find({ isVerified: false }).populate("planId");
  return records.map((s) => ({
    "RO Code": s.planId?.roCode || "",
    "RO Name": s.planId?.roName || "",
    Region: s.planId?.region || "",
    Engineer: s.planId?.engineer || "",
    Date: s.planId?.date ? new Date(s.planId.date).toISOString().slice(0, 10) : "",
    "Earthing Status": s.earthingStatus || "",
    Voltage: s.voltageReading || "",
    "DU Offline": s.duOffline || "",
    "DU Dependency": s.duDependency || "",
    "DU Remark": s.duRemark || "",
    "Tank Offline": s.tankOffline || "",
    "Tank Dependency": s.tankDependency || "",
    "Tank Remark": s.tankRemark || "",
  }));
}

async function fetchPendingJioBPStatusRows() {
  const records = await JioBPStatus.find({ isVerified: false }).populate("planId");
  return records.map((s) => ({
    "RO Code": s.planId?.roCode || "",
    "RO Name": s.planId?.roName || "",
    Region: s.planId?.region || "",
    Engineer: s.planId?.engineer || "",
    Date: s.planId?.date ? new Date(s.planId.date).toISOString().slice(0, 10) : "",
    "HPSD ID": s.hpsdId || "",
    Diagnosis: s.diagnosis || "",
    Solution: s.solution || "",
    "Spare Required": s.spareRequired || "",
    "Observation Hours": s.observationHours || "",
    "Relcon Support": s.relconsupport || "",
    "RBML Person": s.rbmlperson || "",
    Status: s.status || "",
    "Created By": s.createdBy || "",
  }));
}

async function buildPendingReportsWorkbookBuffer() {
  const [verifyRows, jioRows] = await Promise.all([
    fetchPendingVerifyStatusRows(),
    fetchPendingJioBPStatusRows(),
  ]);

  const wb = XLSX.utils.book_new();
  const verifySheet = buildSheetFromRows("Pending Verify Status", verifyRows);
  const jioSheet = buildSheetFromRows("Pending JioBP Status", jioRows);

  XLSX.utils.book_append_sheet(wb, verifySheet.ws, verifySheet.name);
  XLSX.utils.book_append_sheet(wb, jioSheet.ws, jioSheet.name);

  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return { buffer, counts: { verify: verifyRows.length, jio: jioRows.length } };
}

module.exports = { buildPendingReportsWorkbookBuffer };