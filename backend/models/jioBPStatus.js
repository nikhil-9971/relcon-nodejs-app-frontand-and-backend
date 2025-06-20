const mongoose = require("mongoose");

const jioBPStatusSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyPlan",
      required: true,
    },
    hpsdId: {
      type: String,
      required: true,
    },
    solution: {
      type: String,
      required: true,
    },
    activeMaterialUsed: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },
    usedMaterialDetails: {
      type: String,
    },
    faultyMaterialDetails: {
      type: String,
    },
    spareRequired: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },
    observationHours: {
      type: String,
    },
    materialRequirement: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Resolved", "Unresolved"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("JioBPStatus", jioBPStatusSchema);
