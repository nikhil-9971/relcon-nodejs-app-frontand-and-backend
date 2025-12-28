const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const BPCLStatus = require("../models/BPCLStatus");
const DailyPlan = require("../models/DailyPlan");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ CREATE or UPDATE BPCL STATUS (same logic as JIO)
router.post("/saveBPCLStatus", authMiddleware, async (req, res) => {
  try {
    const { planId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(planId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Plan ID" });
    }

    let status = await BPCLStatus.findOne({ planId });

    if (status) {
      // 🔄 UPDATE
      Object.assign(status, req.body);
    } else {
      // 🆕 CREATE
      status = new BPCLStatus({
        ...req.body,
        createdBy: req.user?.username || "unknown",
      });
    }

    const savedStatus = await status.save();

    // --- NEW: update DailyPlan to mark BPCL status saved ---
    try {
      await DailyPlan.findByIdAndUpdate(
        planId,
        { saveBPCLStatus: true },
        { new: true }
      );
    } catch (errUpdate) {
      console.warn("⚠️ Failed to update DailyPlan flag for BPCL:", errUpdate);
      // do not fail whole request — BPCL status is already saved
    }

    res.status(200).json({
      success: true,
      message: "✅ BPCL Status saved successfully",
      data: savedStatus,
    });
  } catch (err) {
    console.error("❌ Error saving BPCL status:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

// ✅ GET BPCL STATUS BY PLAN ID
router.get("/getBPCLStatusByPlan/:planId", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.planId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Plan ID" });
    }

    const status = await BPCLStatus.findOne({
      planId: req.params.planId,
    });

    if (!status) {
      return res
        .status(404)
        .json({ success: false, message: "BPCL Status not found" });
    }

    res.status(200).json(status);
  } catch (err) {
    console.error("❌ Error fetching BPCL status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ GET ALL BPCL STATUS (Dashboard / Admin)
router.get("/getAllBPCLStatus", authMiddleware, async (req, res) => {
  try {
    const statuses = await BPCLStatus.find({}).populate("planId");
    res.status(200).json(statuses);
  } catch (err) {
    console.error("❌ Error fetching BPCL statuses:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ UPDATE BPCL STATUS BY ID (Edit case – same as JIO)
router.put("/updateBPCLStatus/:id", authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid ObjectId" });
    }

    const oldData = await BPCLStatus.findById(id);
    if (!oldData) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    // 🔒 Lock verified record
    if (oldData.isVerified && req.user?.username !== "nikhil.trivedi") {
      return res.status(403).json({
        success: false,
        message: "Verified records can only be updated by admin",
      });
    }

    const updated = await BPCLStatus.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    res.status(200).json({
      success: true,
      message: "BPCL Status updated",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Error updating BPCL status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ VERIFY BPCL STATUS
router.put("/verifyBPCLStatus/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user?.username !== "nikhil.trivedi" || req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const updated = await BPCLStatus.findByIdAndUpdate(
      req.params.id,
      {
        isVerified: true,
        verifiedBy: req.user.username,
        verifiedAt: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    res.status(200).json({
      success: true,
      message: "✅ BPCL Status verified",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Error verifying BPCL status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ DELETE BPCL STATUS
router.delete("/deleteBPCLStatus/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await BPCLStatus.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Record not found" });
    }

    res.status(200).json({
      success: true,
      message: "BPCL Status deleted",
    });
  } catch (err) {
    console.error("❌ Error deleting BPCL status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
