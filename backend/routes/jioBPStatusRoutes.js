const express = require("express");
const router = express.Router();
const JioBPStatus = require("../models/jioBPStatus");
const DailyPlan = require("../models/DailyPlan");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ SAVE or UPDATE Jio BP Status
router.post("/saveJioBPStatus", authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;

    let savedStatus;

    const existing = await JioBPStatus.findOne({ planId });
    if (existing) {
      // 🔁 Update existing status
      Object.assign(existing, req.body);
      savedStatus = await existing.save();
    } else {
      // ➕ Create new status
      const newStatus = new JioBPStatus(req.body);
      savedStatus = await newStatus.save();
    }

    // ✅ Mark status flags in DailyPlan
    await DailyPlan.findByIdAndUpdate(planId, {
      jioBPStatusSaved: true,
      statusSaved: true,
    });

    const updatedPlan = await DailyPlan.findById(planId);

    res.status(200).json({
      success: true,
      message: "✅ Jio BP status saved successfully",
      status: savedStatus,
      plan: updatedPlan,
    });
  } catch (err) {
    console.error("❌ Error saving Jio BP status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ GET Jio BP Status by Plan ID
router.get(
  "/getJioBPStatusByPlan/:planId",
  authMiddleware,
  async (req, res) => {
    try {
      const status = await JioBPStatus.findOne({ planId: req.params.planId });
      if (!status) {
        return res
          .status(404)
          .json({ success: false, message: "Status not found" });
      }
      res.status(200).json(status);
    } catch (err) {
      console.error("❌ Error fetching Jio BP status:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
