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

router.post("/add", async (req, res) => {
  try {
    const { roCode, roName, region, phase, engineer, amcQtr } = req.body;

    if (!roCode || !roName || !region || !phase || !engineer || !amcQtr) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await ROMaster.findOne({
      roCode: roCode.toUpperCase().trim(),
    });
    if (existing) {
      return res.status(400).json({ message: "RO Code already exists" });
    }

    const newEntry = new ROMaster({
      roCode: roCode.toUpperCase(),
      roName,
      region,
      phase,
      engineer,
      amcQtr,
    });

    await newEntry.save();
    res.status(200).json({ message: "Site added successfully" });
  } catch (err) {
    console.error("Error saving new site:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
