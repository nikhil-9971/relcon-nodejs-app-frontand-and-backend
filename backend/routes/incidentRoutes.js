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
router.put("/updateIncidentStatus", async (req, res) => {
  try {
    const { incidentId, status } = req.body;
    if (!incidentId || !status) {
      return res.status(400).json({ error: "Missing incidentId or status" });
    }

    const updated = await Incident.findOneAndUpdate(
      { incidentId },
      { status },
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

// ========== 3. GET ALL INCIDENTS ========== //
router.get("/getAllIncidents", async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ incidentDate: -1 });
    res.json({ success: true, incidents });
  } catch (err) {
    console.error("Fetch error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
