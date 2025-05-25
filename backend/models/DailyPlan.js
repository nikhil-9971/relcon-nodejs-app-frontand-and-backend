const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema({
  roCode: String,
  roName: String,
  region: String,
  salesArea: String,
  phase: String,
  date: String,
  issueType: String,
  engineer: String,
  amcQtr: String,
  purpose: String,
});

module.exports =
  mongoose.models.DailyPlan || mongoose.model("DailyPlan", PlanSchema);
