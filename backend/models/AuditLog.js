const mongoose = require("mongoose");

const loginLogSchema = new mongoose.Schema({
  engineerName: String,
  username: String,
  role: String,
  loginTime: { type: Date, default: Date.now },
  ip: String,
});

const auditTrailSchema = new mongoose.Schema({
  modifiedBy: String,
  action: String, // e.g., 'edit' or 'delete'
  recordType: String, // e.g., 'status', 'user', etc.
  timestamp: { type: Date, default: Date.now },
  before: Object,
  after: Object,
  roCode: String, // ✅ new
  roName: String, // ✅ new
  visitDate: String, // ✅ new
  engineerName: String, // ✅ new
});

module.exports = {
  LoginLog: mongoose.model("LoginLog", loginLogSchema),
  AuditTrail: mongoose.model("AuditTrail", auditTrailSchema),
};
