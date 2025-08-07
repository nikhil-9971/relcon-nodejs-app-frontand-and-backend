// models/Incident.js
const mongoose = require("mongoose");

const IncidentSchema = new mongoose.Schema({
  incidentId: String,
  roCode: String,
  siteName: String,
  region: String,
  incidentDate: String,
  status: String, // "Close" or "Pending"
});

module.exports = mongoose.model("Incident", IncidentSchema);
