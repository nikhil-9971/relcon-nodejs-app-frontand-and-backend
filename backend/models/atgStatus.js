const mongoose = require("mongoose");

const atgStatusSchema = new mongoose.Schema({
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DailyPlan",
    required: true,
  },
  probeStatus: String,
  calibrationInfo: String,
  remarks: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("ATGStatus", atgStatusSchema);
