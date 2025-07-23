const fs = require("fs");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const MONGO_URI =
  "mongodb+srv://nikhil9971:nikhil997164@relcon.vutl973.mongodb.net/relcondb?retryWrites=true&w=majority&appName=relcon";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  engineerName: String,
  empId: String,
});

const User = mongoose.model("User", UserSchema);

const users = [];

fs.createReadStream("users detail.csv")
  .pipe(csv())
  .on("data", (row) => {
    users.push(row);
  })
  .on("end", async () => {
    console.log("📄 CSV file read complete");

    for (const user of users) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await User.create({
        engineerName: user.engineerName,
        username: user.username,
        password: hashedPassword,
        role: user.role,
        empId: user.empId,
      });
    }

    console.log("✅ Users with roles and engineer names imported");
    mongoose.connection.close();
  });
