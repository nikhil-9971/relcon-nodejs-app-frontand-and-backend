const express = require("express");
const router = express.Router();
const JioBPStatus = require("../models/jioBPStatus");
const DailyPlan = require("../models/DailyPlan"); // ✅ Fixed
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

    // ✅ Update DailyPlan to mark JioBPStatus and Status saved
    await DailyPlan.findByIdAndUpdate(planId, {
      statusSaved: true,
      jioBPStatusSaved: true,
    });

    const updatedPlan = await DailyPlan.findById(planId);
    res.status(200).json({ message: "Jio BP status saved", plan: updatedPlan });
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
