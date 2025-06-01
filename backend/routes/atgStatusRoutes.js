const express = require("express");
const router = express.Router();
const ATGStatus = require("../models/atgStatus");

router.post("/atg-status", async (req, res) => {
  try {
    const newStatus = new ATGStatus(req.body);
    await newStatus.save();
    res.status(201).json({ message: "ATG status saved" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save ATG status" });
  }
});

router.get("/atg-status/:planId", async (req, res) => {
  try {
    const result = await ATGStatus.findOne({ planId: req.params.planId });
    if (!result) return res.status(404).json({ error: "Not found" });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error fetching ATG status" });
  }
});

module.exports = router;
