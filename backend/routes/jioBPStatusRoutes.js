const express = require("express");
const router = express.Router();
const JioBPStatus = require("../models/jioBPStatus");
const authMiddleware = require("../middleware/authMiddleware");

// POST /saveJioBPStatus
router.post("/saveJioBPStatus", authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;

    // Prevent duplicate entry
    const existing = await JioBPStatus.findOne({ planId });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Status already exists for this plan" });
    }

    const newStatus = new JioBPStatus(req.body);
    await newStatus.save();

    // Optionally update DailyPlan to mark JioBPStatus saved
    await require("../models/DailyPlan").findByIdAndUpdate(planId, {
      jioBPStatusSaved: true,
    });

    res.status(200).json({ message: "Jio BP status saved" });
  } catch (err) {
    console.error("Error saving Jio BP status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /getJioBPStatusByPlan/:planId
router.get("/getJioBPStatusByPlan/:planId", async (req, res) => {
  try {
    const status = await JioBPStatus.findOne({ planId: req.params.planId });
    if (!status) {
      return res.status(404).json({ message: "Status not found" });
    }
    res.status(200).json(status);
  } catch (err) {
    console.error("Error fetching Jio BP status:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
