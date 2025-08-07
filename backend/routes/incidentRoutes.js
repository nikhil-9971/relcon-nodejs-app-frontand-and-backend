const express = require("express");
const router = express.Router();
const Incident = require("../models/Incident");

// 🔁 Bulk Import Incidents
fetch(`${backendURL}/bulkImportIncident`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ incidents: data }),
})
  .then(async (res) => {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const result = await res.json();
      if (result.success) showToast("✅ Data imported successfully");
      else throw new Error(result.error || "Import failed.");
    } else {
      throw new Error("❌ Invalid server response");
    }
  })
  .catch((err) => {
    console.error("Import error:", err);
    showToast("❌ Failed to import data");
  });

// ✅ Update Incident Status
// PUT: Update status (Pending/Close)
router.put("/updateIncidentStatus", async (req, res) => {
  const { incidentId, status } = req.body;
  try {
    await sheet.updateRow("IncidentData", "Incident ID", incidentId, {
      Status: status,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
