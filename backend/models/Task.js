const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  statusId: String, // Status Record ID (for traceability)
  roCode: String,
  roName: String,
  engineer: String,
  issue: String, // e.g., "Earthing NOT OK" or "DU Offline: 2"
  emailContent: String,
  status: { type: String, default: "Pending" }, // Pending, Mailed, Resolved
  mailReply: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Task", taskSchema);
