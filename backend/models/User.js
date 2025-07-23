const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  engineerName: String,
  empId: String,
});
module.exports =
  mongoose.model.UserSchema || mongoose.model("User", UserSchema, "users");
