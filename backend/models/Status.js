const mongoose = require("mongoose");

const StatusSchema = new mongoose.Schema({
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "DailyPlan" },
  createdAt: { type: Date, default: Date.now },
  probeMake: String,
  probeSize: String,
  lowProductLock: String,
  highWaterSet: String,
  duSerialNumber: String,
  dgStatus: String,
  connectivityType: String,
  sim1Provider: String,
  sim1Number: String,
  sim2Provider: String,
  sim2Number: String,
  iemiNumber: String,
  bosVersion: String,
  fccVersion: String,
  wirelessSlave: String,
  sftpConfig: String,
  adminPassword: String,
  workCompletion: String,
  earthingStatus: String,
  voltageReading: String,
  duOffline: String,
  duRemark: String,
  locationField: String,
  isVerified: {
    type: Boolean,
    default: false,
  },
});

module.exports =
  mongoose.model.StatusSchema ||
  mongoose.model("Status", StatusSchema, "status");
