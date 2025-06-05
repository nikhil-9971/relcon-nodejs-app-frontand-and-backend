const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { LoginLog } = require("../models/AuditLog");

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
    await LoginLog.create({
      engineerName: user.engineerName || user.name || "Unknown",
      username: user.username,
      role: user.role,
      ip:
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress,
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
