const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { LoginLog } = require("../models/AuditLog");
const fetch = require("node-fetch"); // 👈 at top

const SECRET = process.env.JWT_SECRET || "relcon-secret-key"; // Add this in .env file

// 🔐 Login - returns JWT
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const payload = {
    username: user.username,
    role: user.role,
    engineerName: user.engineerName,
  };

  const token = jwt.sign(payload, SECRET, { expiresIn: "2h" });

  // ✅ Save login log

  // ✅ Save login log
  try {
    const ipAddress =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.ip ||
      req.connection.remoteAddress;

    let location = "Unknown";

    try {
      const response = await fetch(
        `https://ipinfo.io/${ipAddress}?token=be1a52b6573c44`
      );
      const data = await response.json();

      if (data.status === "success") {
        location = `${data.city}, ${data.region}, ${data.country}`;
      }
    } catch (err) {
      console.error("IP location fetch error:", err.message);
    }

    await LoginLog.create({
      engineerName: user.engineerName || user.name || "Unknown",
      username: user.username,
      role: user.role,
      ip: ipAddress,
      location, // ✅ new field
    });
  } catch (logErr) {
    console.error("LoginLog error:", logErr.message);
  }

  res.json({ token });
});

// 🔒 Get logged-in user info (requires token)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

router.get("/user", verifyToken, (req, res) => {
  res.json(req.user);
});

// Logout not required with JWT – handled on frontend by clearing localStorage
// But optional dummy route if needed
router.post("/logout", (req, res) => {
  res.status(200).json({ message: "Client should clear token manually" });
});

//module.exports = router;

module.exports = {
  router,
  verifyToken,
};
