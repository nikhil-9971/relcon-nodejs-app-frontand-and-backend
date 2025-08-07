const express = require("express");
const router = express.Router();
const Incident = require("../models/Incident"); // Mongoose model

// ========== 1. BULK IMPORT INCIDENT ========== //
router.post("/bulkImportIncident", async (req, res) => {
  try {
    const { incidents } = req.body;
    if (!Array.isArray(incidents) || incidents.length === 0) {
      return res.status(400).json({ error: "No data to import" });
    }

    await Incident.insertMany(incidents);
    res.json({ success: true, message: "Incidents imported to MongoDB" });
  } catch (err) {
    console.error("Bulk import error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== 2. UPDATE INCIDENT STATUS ========== //
router.post("/updateIncidentStatus", async (req, res) => {
  try {
    const { incidentId, newStatus } = req.body;
    if (!incidentId || !newStatus) {
      return res.status(400).json({ error: "Missing incidentId or newStatus" });
    }

    const updated = await Incident.findOneAndUpdate(
      { incidentId },
      { status: newStatus },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Incident ID not found" });
    }

    res.json({ success: true, updated });
  } catch (err) {
    console.error("Status update error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
