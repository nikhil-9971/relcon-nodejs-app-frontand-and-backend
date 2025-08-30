const mongoose = require("mongoose");

const ROMasterSchema = new mongoose.Schema({
  zone: String,
  roCode: String,
  roName: String,
  region: String,
  phase: String,
  engineer: String,
  siteStatus: String,
  amcQtr: String,
});

module.exports =
  mongoose.models.ROMaster ||
  mongoose.model("ROMaster", ROMasterSchema, "romasters");
