const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Status = require("../models/Status");

// Save or update status
router.post("/saveStatus", async (req, res) => {
  try {
    const { planId } = req.body;

    await Status.findOneAndUpdate({ planId }, req.body, {
      upsert: true,
      new: true,
    });

    res.send("Status saved");
  } catch (err) {
    console.error("Save error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// Get all merged status records
router.get("/getMergedStatusRecords", async (req, res) => {
  try {
    const statusRecords = await Status.find().populate("planId");

    const merged = statusRecords.map((record) => {
      const plan = record.planId || {};
      const status = record || {};

      return {
        planId: status.planId?.toString() || "",
        _id: status._id?.toString() || "",
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
    console.error("Fetch error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// Update status by planId or _id
router.put("/updateStatus/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || id === "undefined") {
    return res.status(400).send("Invalid ID provided.");
  }

  try {
    let result = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      result = await Status.findOneAndUpdate({ planId: id }, req.body, {
        new: true,
      });
      if (!result) {
        result = await Status.findByIdAndUpdate(id, req.body, { new: true });
      }
    }

    if (!result) return res.status(404).send("Status not found");
    res.json(result);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Update error: " + err.message);
  }
});

// Delete status by planId or _id
router.delete("/deleteStatus/:id", async (req, res) => {
  const { id } = req.params;
  console.log("DELETE request for:", id);

  if (!id || id === "undefined") {
    return res.status(400).send("Invalid ID provided.");
  }

  try {
    let deleted = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Status.findOneAndDelete({ planId: id });
      if (!deleted) {
        deleted = await Status.findByIdAndDelete(id);
      }
    }

    if (!deleted) return res.status(404).send("Status not found");
    res.send("Status deleted");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Delete error: " + err.message);
  }
});

module.exports = router;
