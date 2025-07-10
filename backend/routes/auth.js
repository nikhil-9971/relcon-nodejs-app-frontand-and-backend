const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { LoginLog } = require("../models/AuditLog");
const fetch = require("node-fetch");

const SECRET = process.env.JWT_SECRET || "relcon-secret-key";

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

  // ✅ Get real IP
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "UNKNOWN";

  console.log("🔍 Login IP:", ipAddress);

  // ✅ Fetch location
  let location = "Unknown";

  try {
    const response = await fetch(
      `https://ipinfo.io/${ipAddress}?token=be1a52b6573c44`
    );
    const data = await response.json();

    console.log("📡 IPInfo response:", data); // Debug

    // ✅ check for city, region, country
    if (data && data.city && data.region && data.country) {
      location = `${data.city}, ${data.region}, ${data.country}, ${data.org}`;
    }
  } catch (err) {
    console.error("IP location fetch error:", err.message);
  }

  // ✅ Save login log
  try {
    await LoginLog.create({
      engineerName: user.engineerName || user.name || "Unknown",
      username: user.username,
      role: user.role,
      ip: ipAddress,
      location,
    });
  } catch (logErr) {
    console.error("📛 LoginLog error:", logErr.message);
  }

  //res.json({ token });
  res.json({
    token,
    user: {
      username: user.username,
      role: user.role,
      engineerName: user.engineerName,
    },
  });
});

// 🔒 Middleware: Verify token
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

// 🔍 Logged-in user info
router.get("/user", verifyToken, (req, res) => {
  res.json(req.user);
});

// 🔓 Dummy logout (handled on frontend)
router.post("/logout", (req, res) => {
  res.status(200).json({ message: "Client should clear token manually" });
});

// ✅ Export router and middleware
module.exports = {
  router,
  verifyToken,
};
