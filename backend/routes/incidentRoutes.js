const express = require("express");
const router = express.Router();
const Incident = require("../models/Incident");

// 🔁 Bulk Import Incidents
router.post("/bulkImportIncident", async (req, res) => {
  try {
    const { incidents } = req.body;
    if (!Array.isArray(incidents) || incidents.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No data received" });
    }

    await Incident.insertMany(incidents);
    res.json({ success: true, message: "Data imported successfully" });
  } catch (err) {
    console.error("Bulk import error:", err.message);
    res
      .status(500)
      .json({ success: false, message: "Server error during import" });
  }
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
