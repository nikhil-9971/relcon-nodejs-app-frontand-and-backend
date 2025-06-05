const express = require("express");
const router = express.Router();
const { LoginLog, AuditTrail } = require("../models/AuditLog");

// Get Login Logs
router.get("/loginLogs", async (req, res) => {
  try {
    const logs = await LoginLog.find().sort({ loginTime: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch login logs" });
  }
});

// Get Audit Trails
router.get("/auditTrails", async (req, res) => {
  try {
    const trails = await AuditTrail.find().sort({ timestamp: -1 }).limit(100);
    res.json(trails);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit trails" });
  }
});

module.exports = router;
