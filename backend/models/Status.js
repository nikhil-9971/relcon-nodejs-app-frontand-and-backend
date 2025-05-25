const mongoose = require("mongoose");

const StatusSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "DailyPlan" },
  createdAt: { type: Date, default: Date.now },
  probeMake: { type: String, required: true },
  lowProductLock: { type: String, required: true },
  highWaterSet: { type: String, required: true },
  duSerialNumber: { type: String, required: true },
  connectivityType: { type: String, required: true },
  sim1Provider: { type: String, required: true },
  sim1Number: { type: String, required: true },
  sim2Provider: { type: String, required: true },
  sim2Number: { type: String, required: true },
  iemiNumber: { type: String, required: true },
  bosVersion: { type: String, required: true },
  fccVersion: { type: String, required: true },
  wirelessSlave: { type: String, required: true },
  sftpConfig: { type: String, required: true },
  adminPassword: { type: String, required: true },
  workCompletion: { type: String, required: true },
  earthingStatus: { type: String, required: true },
  duOffline: { type: String, required: true },
  duRemark: { type: String, required: true },
  locationField: { type: String, required: true },
});

module.exports =
  mongoose.model.StatusSchema ||
  mongoose.model("Status", StatusSchema, "status");
