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

module.exports = router;
