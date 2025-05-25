const mongoose = require("mongoose");

const ROMasterSchema = new mongoose.Schema({
  roCode: String,
  roName: String,
  region: String,
  phase: String,
  engineer: String,
});

module.exports =
  mongoose.models.ROMaster ||
  mongoose.model("ROMaster", ROMasterSchema, "romasters");
