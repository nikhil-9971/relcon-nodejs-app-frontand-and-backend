const mongoose = require("mongoose");

const BPCLStatusSchema = new mongoose.Schema(
  {
    // 🔗 One BPCL Status per Daily Plan (same as JIO)
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DailyPlan",
      required: true,
      unique: true,
    },

    // 🔹 IOT CLASS 1
    class1DeviceCount: {
      type: Number,
      required: true,
    },
    class1Devices: [
      {
        type: String,
        uppercase: true,
        trim: true,
      },
    ],

    // 🔹 IOT CLASS 2
    class2DeviceCount: {
      type: Number,
      required: true,
    },
    class2Devices: [
      {
        type: String,
        uppercase: true,
        trim: true,
      },
    ],

    // 🔹 SIM DETAILS
    jioSimNumber: {
      type: String,
      trim: true,
    },
    airtelSimNumber: {
      type: String,
      trim: true,
    },

    // 🔹 COMMON (same as JIO)
    createdBy: {
      type: String,
      default: "",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: String,
      default: "",
    },
    verifiedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.BPCLStatus || mongoose.model("BPCLStatus", BPCLStatusSchema);
