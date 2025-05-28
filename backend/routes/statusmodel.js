const express = require("express");
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

    const merged = statusRecords.map(({ planId: plan, ...status }) => ({
      engineer: plan?.engineer || "",
      region: plan?.region || "",
      phase: plan?.phase || "",
      roCode: plan?.roCode || "",
      roName: plan?.roName || "",
      date: plan?.date || "",
      amcQtr: plan?.amcQtr || "", // ✅ Add this line
      purpose: plan?.purpose || "",

      probeMake: status.probeMake,
      lowProductLock: status.lowProductLock,
      highWaterSet: status.highWaterSet,
      duSerialNumber: status.duSerialNumber,
      dgStatus: status.dgStatus,
      connectivityType: status.connectivityType,
      sim1Provider: status.sim1Provider,
      sim1Number: status.sim1Number,
      sim2Provider: status.sim2Provider,
      sim2Number: status.sim2Number,
      iemiNumber: status.iemiNumber,
      bosVersion: status.bosVersion,
      fccVersion: status.fccVersion,
      wirelessSlave: status.wirelessSlave,
      sftpConfig: status.sftpConfig,
      adminPassword: status.adminPassword,
      workCompletion: status.workCompletion,
      earthingStatus: status.earthingStatus,
      duOffline: status.duOffline,
      duRemark: status.duRemark,
      locationField: status.locationField,
    }));

    res.json(merged);
  } catch (err) {
    res.status(500).send("Server error: " + err.message);
  }
});

module.exports = router;
