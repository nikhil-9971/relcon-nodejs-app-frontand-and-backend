const express = require("express");
const router = express.Router();
const Incident = require("../models/Incident");

// 🔁 Bulk Import Incidents
router.post("/bulk-import", async (req, res) => {
  try {
    const { incidents } = req.body;

    if (!Array.isArray(incidents)) {
      return res.status(400).json({ message: "Invalid data" });
    }

    const docs = incidents.map((i) => ({
      incidentId: i.incidentId?.toUpperCase(),
      roCode: i.roCode?.toUpperCase(),
      siteName: i.siteName,
      region: i.region,
      incidentDate: i.incidentDate,
      status: i.status,
    }));

    await Incident.insertMany(docs, { ordered: false });
    res.json({ message: "✅ Data imported" });
  } catch (err) {
    res.status(200).json({ message: "Imported with some duplicates/skips" });
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
