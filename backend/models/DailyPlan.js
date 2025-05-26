const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema({
  roCode: String,
  roName: String,
  region: String,
  phase: String,
  date: String,
  issueType: String,
  engineer: String,
  amcQtr: String,
  purpose: String,
  completionStatus: String, // Add this field
});

module.exports =
  mongoose.models.DailyPlan || mongoose.model("DailyPlan", PlanSchema);
