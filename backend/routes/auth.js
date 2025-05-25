const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../models/User");

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).send("Invalid credentials");

  req.session.user = {
    username: user.username,
    role: user.role,
    engineerName: user.engineerName,
  };

  res.json(req.session.user);
});

router.get("/user", (req, res) => {
  if (req.session.user) res.json(req.session.user);
  else res.status(401).json({ error: "Not logged in" });
});

router.post("/logout", (req, res) => {
  req.session.destroy();
  res.sendStatus(200);
});

module.exports = router;
