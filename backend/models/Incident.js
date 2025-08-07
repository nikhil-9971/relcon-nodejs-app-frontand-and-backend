const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema({
  roCode: String,
  siteName: String,
  region: String,
  incidentId: String,
  incidentDate: String,
  status: { type: String, default: "Pending" },
});

module.exports = mongoose.model("Incident", incidentSchema);
