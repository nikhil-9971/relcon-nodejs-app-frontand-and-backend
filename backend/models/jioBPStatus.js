const mongoose = require("mongoose");

const JioBPStatusSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyPlan",
      required: true,
      unique: true, // ❗Only one status per plan
    },
    hpsdId: {
      type: String,
      required: true,
    },
    diagnosis: {
      type: String,
      required: true,
    },
    solution: {
      type: String,
      required: true,
    },
    activeMaterialUsed: {
      type: String,
      required: true,
    },
    usedMaterialDetails: {
      type: String,
      default: "",
    },
    faultyMaterialDetails: {
      type: String,
      default: "",
    },
    spareRequired: {
      type: String,
      required: true,
    },
    observationHours: {
      type: String,
      default: "",
    },
    materialRequirement: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("JioBPStatus", JioBPStatusSchema);
