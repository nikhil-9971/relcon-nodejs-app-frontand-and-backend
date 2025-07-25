const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema({
  roCode: String,
  roName: String,
  region: String,
  phase: String,
  date: String,
  issueType: String,
  engineer: String,
  empId: String,
  amcQtr: String,
  incidentId: String,
  purpose: String,
  completionStatus: String, // Add this field
  arrivalTime: String,
  leaveTime: String,
  supportTakenFrom: String,
  whatDone: String,
});

module.exports =
  mongoose.models.DailyPlan || mongoose.model("DailyPlan", PlanSchema);
