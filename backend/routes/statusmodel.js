const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Status = require("../models/Status");

// Save Status Route
router.post("/saveStatus", async (req, res) => {
  try {
    const {
      planId,
      probeMake,
      lowProductLock,
      highWaterSet,
      duSerialNumber,
      dgStatus,
      connectivityType,
      sim1Provider,
      sim1Number,
      sim2Provider,
      sim2Number,
      iemiNumber,
      bosVersion,
      fccVersion,
      wirelessSlave,
      sftpConfig,
      adminPassword,
      workCompletion,
      earthingStatus,
      duOffline,
      duRemark,
      locationField,
    } = req.body;

    await Status.findOneAndUpdate(
      { planId },
      {
        planId,
        probeMake,
        lowProductLock,
        highWaterSet,
        duSerialNumber,
        dgStatus,
        connectivityType,
        sim1Provider,
        sim1Number,
        sim2Provider,
        sim2Number,
        iemiNumber,
        bosVersion,
        fccVersion,
        wirelessSlave,
        sftpConfig,
        adminPassword,
        workCompletion,
        earthingStatus,
        duOffline,
        duRemark,
        locationField,
      },
      { upsert: true, new: true }
    );

    res.send("Status saved");
  } catch (err) {
    res.status(500).send("Server error: " + err.message);
  }
});

// New Api added for Status record fetch
router.get("/getMergedStatusRecords", async (req, res) => {
  try {
    const statusRecords = await Status.find().populate("planId");

    const merged = statusRecords.map((record) => {
      const plan = record.planId || {};
      const status = record || {};

      return {
        engineer: plan.engineer || "",
        region: plan.region || "",
        phase: plan.phase || "",
        roCode: plan.roCode || "",
        roName: plan.roName || "",
        date: plan.date || "",
        amcQtr: plan.amcQtr || "",
        purpose: plan.purpose || "",

        probeMake: status.probeMake || "",
        lowProductLock: status.lowProductLock || "",
        highWaterSet: status.highWaterSet || "",
        duSerialNumber: status.duSerialNumber || "",
        dgStatus: status.dgStatus || "",
        connectivityType: status.connectivityType || "",
        sim1Provider: status.sim1Provider || "",
        sim1Number: status.sim1Number || "",
        sim2Provider: status.sim2Provider || "",
        sim2Number: status.sim2Number || "",
        iemiNumber: status.iemiNumber || "",
        bosVersion: status.bosVersion || "",
        fccVersion: status.fccVersion || "",
        wirelessSlave: status.wirelessSlave || "",
        sftpConfig: status.sftpConfig || "",
        adminPassword: status.adminPassword || "",
        workCompletion: status.workCompletion || "",
        earthingStatus: status.earthingStatus || "",
        duOffline: status.duOffline || "",
        duRemark: status.duRemark || "",
        locationField: status.locationField || "",
      };
    });

    res.json(merged);
  } catch (err) {
    res.status(500).send("Server error: " + err.message);
  }
});

router.delete("/deleteStatus/:id", async (req, res) => {
  const { id } = req.params;
  console.log("DELETE request for:", id);

  if (!id || id === "undefined") {
    return res.status(400).send("❌ Invalid ID provided.");
  }

  try {
    let deleted = null;

    // Check if it's a valid ObjectId
    const isValidId = mongoose.Types.ObjectId.isValid(id);

    if (isValidId) {
      deleted = await Status.findOneAndDelete({ planId: id });
      if (!deleted) {
        deleted = await Status.findByIdAndDelete(id);
      }
    }

    if (!deleted) {
      return res.status(404).send("❌ Status not found.");
    }

    res.send("✅ Status deleted.");
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).send("❌ Server error: " + err.message);
  }
});

router.put("/updateStatus/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    console.log("Updating:", id, updateData);

    // Try update by planId
    let result = await Status.findOneAndUpdate({ planId: id }, updateData, {
      new: true,
    });

    // Fallback by _id
    if (!result) {
      result = await Status.findByIdAndUpdate(id, updateData, { new: true });
    }

    if (!result) return res.status(404).send("Status not found");
    res.json(result);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Update error: " + err.message);
  }
});

module.exports = router;
