const express = require("express");
const router = express.Router();
const ROMaster = require("../models/ROMaster");

router.get("/getROInfo/:roCode", async (req, res) => {
  try {
    const roCode = req.params.roCode.toUpperCase();
    const data = await ROMaster.findOne({ roCode });
    if (!data) return res.status(404).json({ error: "RO Code not found" });
    res.json(data);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
