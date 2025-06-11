const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Status = require("../models/Status");
const { AuditTrail } = require("../models/AuditLog");
const jwt = require("jsonwebtoken");

// models required at top
const Task = require("../models/Task");
const DailyPlan = require("../models/DailyPlan"); // if not already imported

const { verifyToken } = require("./auth");

const SECRET = process.env.JWT_SECRET || "relcon-secret-key";

// ✅ Utility: Email content generator
function generateEmailContent({
  roName,
  roCode,
  date,
  earthingStatus,
  duOffline,
  voltageReading,
  duRemark,
}) {
  let observations = [];

  if (earthingStatus === "NOT OK") {
    observations.push(`➡️ Earthing is NOT OK (${voltageReading || "N/A"}V)`);
  }

  if (duOffline && duOffline !== 0 && duOffline !== "ALL OK") {
    let duLine = `➡️ DU Offline Count: ${duOffline}`;
    if (duRemark) {
      duLine += `\n   🔹 Remark: ${duRemark}`;
    }
    observations.push(duLine);
  }

  const observationText = observations.length
    ? observations.join("\n")
    : "➡️ No major issues reported.";

  return `Dear Sir/Ma'am,\n\nDuring the recent visit on dated ${date} at ${roName} (RO Code: ${roCode}), the engineer observed:\n\n${observationText}\n\nPlease resolve HPCL dependencies at the earliest and confirm on mail after resolution.\n\nRegards,\nRELCON Systems`;
}

// Save Status Route
router.post("/saveStatus", async (req, res) => {
  try {
    const {
      planId,
      probeMake,
      probeSize,
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
      voltageReading,
      duOffline,
      duRemark,
      locationField,
    } = req.body;

    const savedStatus = await Status.findOneAndUpdate(
      { planId },
      {
        planId,
        probeMake,
        probeSize,
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
        voltageReading,
        duOffline,
        duRemark,
        locationField,
      },
      { upsert: true, new: true }
    );

    // ✅ Mark DailyPlan as statusSaved = true
    await DailyPlan.findByIdAndUpdate(planId, { statusSaved: true });

    // ✅ Auto-create task if condition matches
    if (
      earthingStatus === "NOT OK" ||
      (duOffline && duOffline !== 0 && duOffline !== "ALL OK")
    ) {
      const plan = await DailyPlan.findById(planId);
      if (plan) {
        // 🔹 Determine full issue summary
        const issues = [];
        if (earthingStatus === "NOT OK") issues.push("Earthing NOT OK");
        if (duOffline && duOffline !== 0 && duOffline !== "ALL OK")
          issues.push(`DU Offline: ${duOffline}`);

        const issueSummary = issues.join(" + ");

        const task = new Task({
          statusId: savedStatus._id,
          roCode: plan.roCode,
          roName: plan.roName,
          date: plan.date,
          engineer: plan.engineer,
          issue: issueSummary,
          emailContent: generateEmailContent({
            roName: plan.roName,
            roCode: plan.roCode,
            earthingStatus,
            voltageReading,
            duOffline,
            duRemark,
          }),
          earthingStatus,
          voltageReading,
          duOffline,
          duRemark,
        });

        await task.save(); // ✅ Insert the new task
      }
    }

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
        _id: status._id?.toString() || "",
        planId: status.planId?._id?.toString() || "",
        engineer: plan.engineer || "",
        region: plan.region || "",
        phase: plan.phase || "",
        roCode: plan.roCode || "",
        roName: plan.roName || "",
        date: plan.date || "",
        amcQtr: plan.amcQtr || "",
        purpose: plan.purpose || "",
        probeMake: status.probeMake || "",
        probeSize: status.probeSize || "",
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
        voltageReading: status.voltageReading || "",
        duOffline: status.duOffline || "",
        duRemark: status.duRemark || "",
        locationField: status.locationField || "",
        isVerified: status.isVerified || false, // <-- ✅ Add this line
      };
    });

    res.json(merged);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

// Update status by _id
// 🔧 Utility: compare and return only changed fields
function getChangedFields(oldDoc, newDoc) {
  const before = {};
  const after = {};

  for (const key in newDoc) {
    if (JSON.stringify(oldDoc[key]) !== JSON.stringify(newDoc[key])) {
      before[key] = oldDoc[key];
      after[key] = newDoc[key];
    }
  }

  return { before, after };
}

router.put("/updateStatus/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!id || id === "undefined") {
    return res.status(400).send("Invalid ID provided.");
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid ObjectId format.");
    }

    const oldData = await Status.findById(id).populate("planId");

    // ✅ Prevent update if already verified and user is not nikhil.trivedi
    if (oldData?.isVerified && req.user?.username !== "nikhil.trivedi") {
      return res
        .status(403)
        .send("Verified records can only be updated by Nikhil.");
    }

    const updated = await Status.findByIdAndUpdate(id, req.body, {
      new: true,
    }).populate("planId");

    if (!updated) return res.status(404).send("Status not found");

    const { before, after } = getChangedFields(
      oldData.toObject(),
      updated.toObject()
    );

    const plan = updated.planId || {};
    const roCode = plan.roCode || "N/A";
    const roName = plan.roName || "N/A";
    const visitDate = plan.date || "N/A";
    const engineerName = plan.engineer || "N/A";

    await AuditTrail.create({
      modifiedBy: req.user?.username || "unknown",
      action: "edit",
      recordType: "status",
      before,
      after,
      roCode,
      roName,
      visitDate,
      engineerName,
    });

    res.send("Status updated");
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).send("Update error: " + err.message);
  }
});

// Delete status by _id

router.delete("/deleteStatus/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!id || id === "undefined") {
    return res.status(400).send("Invalid ID provided.");
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid ObjectId format.");
    }

    const oldData = await Status.findById(id).populate("planId");

    if (!oldData) return res.status(404).send("Status not found");

    const plan = oldData.planId || {};
    const roCode = plan.roCode || "N/A";
    const roName = plan.roName || "N/A";
    const visitDate = plan.date || "N/A";
    const engineerName = plan.engineer || "N/A";

    const deleted = await Status.findByIdAndDelete(id);

    await AuditTrail.create({
      modifiedBy: req.user?.username || "unknown",
      action: "delete",
      recordType: "status",
      before: oldData.toObject(),
      after: null,
      roCode,
      roName,
      visitDate,
      engineerName,
    });

    res.send("Status deleted");
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).send("Delete error: " + err.message);
  }
});

// ✅ VERIFY a status by ID
router.put("/verifyStatus/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!id || id === "undefined") {
    return res.status(400).send("Invalid ID provided.");
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send("Invalid ObjectId format.");
    }

    const updated = await Status.findByIdAndUpdate(
      id,
      { isVerified: true },
      { new: true }
    ).populate("planId");

    if (!updated) return res.status(404).send("Status not found");

    const plan = updated.planId || {};
    const roCode = plan.roCode || "N/A";
    const roName = plan.roName || "N/A";
    const visitDate = plan.date || "N/A";
    const engineerName = plan.engineer || "N/A";

    await AuditTrail.create({
      modifiedBy: req.user?.username || "unknown",
      action: "verify",
      recordType: "status",
      before: { isVerified: false },
      after: { isVerified: true },
      roCode,
      roName,
      visitDate,
      engineerName,
    });

    res.send("Status verified successfully");
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).send("Verify error: " + err.message);
  }
});

module.exports = router;
