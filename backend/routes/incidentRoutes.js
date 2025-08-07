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
router.put("/update-status", async (req, res) => {
  const { incidentId, status } = req.body;

  if (!incidentId || !status) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  await Incident.findOneAndUpdate({ incidentId }, { status });
  res.json({ message: "✅ Status updated" });
});

module.exports = router;
