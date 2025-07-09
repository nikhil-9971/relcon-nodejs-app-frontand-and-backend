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
      const newStatus = new JioBPStatus({
        ...req.body,
        createdBy: req.user?.username || "unknown",
      });
      savedStatus = await newStatus.save();
    }

    // ✅ Update DailyPlan status flags
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

// ✅ GET All Jio BP Status with Role-Based Access
router.get("/getAllJioBPStatus", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    if (user.role === "engineer") {
      query = { createdBy: user.username };
    }

    const statuses = await JioBPStatus.find(query).populate("planId");
    res.status(200).json(statuses);
  } catch (err) {
    console.error("❌ Error fetching Jio BP statuses:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ UPDATE Jio BP Status by ID

// ✅ UPDATE Jio BP Status by ID
router.put("/updateJioBPStatus/:id", authMiddleware, async (req, res) => {
  try {
    // Sanitize planId: if object, extract _id
    if (typeof req.body.planId === "object" && req.body.planId._id) {
      req.body.planId = req.body.planId._id;
    }

    // Optional: Remove any fields not in schema
    const allowedFields = [
      "engineer",
      "region",
      "roCode",
      "roName",
      "purpose",
      "date",
      "hpsdId",
      "diagnosis",
      "solution",
      "activeMaterialUsed",
      "usedMaterialDetails",
      "faultyMaterialDetails",
      "spareRequired",
      "observationHours",
      "materialRequirement",
      "relconsupport",
      "rbmlperson",
      "status",
      "planId",
      "createdBy",
    ];

    const updateData = {};
    allowedFields.forEach((key) => {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    });

    const updated = await JioBPStatus.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ Error updating Jio BP status:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
});

// ✅ DELETE Jio BP Status by ID
router.delete("/deleteJioBPStatus/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await JioBPStatus.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    // Optional: also update DailyPlan flag (set to false)
    await DailyPlan.findByIdAndUpdate(deleted.planId, {
      jioBPStatusSaved: false,
      statusSaved: false,
    });

    res.status(200).json({ success: true, message: "Record deleted" });
  } catch (err) {
    console.error("❌ Error deleting Jio BP status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
