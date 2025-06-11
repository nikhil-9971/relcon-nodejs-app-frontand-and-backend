const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  statusId: String, // Status Record ID (for traceability)
  roCode: String,
  roName: String,
  date: String,
  engineer: String,
  issue: String, // e.g., "Earthing NOT OK" or "DU Offline: 2"
  emailContent: String,
  status: { type: String, default: "Pending" }, // Pending, Mailed, Resolved
  mailReply: String,
  createdAt: { type: Date, default: Date.now },
  // ✅ Add these for UI display
  earthingStatus: String,
  voltageReading: String,
  duOffline: String,
  duRemark: String,
});

module.exports = mongoose.model("Task", taskSchema);
