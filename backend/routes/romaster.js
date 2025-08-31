const express = require("express");
const router = express.Router();
const ROMaster = require("../models/ROMaster");
const DailyPlan = require("../models/DailyPlan");

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
    const { zone, roCode, roName, region, phase, engineer, amcQtr } = req.body;

    if (
      !zone ||
      !roCode ||
      !roName ||
      !region ||
      !phase ||
      !engineer ||
      !amcQtr
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await ROMaster.findOne({
      roCode: roCode.toUpperCase().trim(),
    });
    if (existing) {
      return res.status(400).json({ message: "RO Code already exists" });
    }

    const newEntry = new ROMaster({
      zone,
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

// New endpoint for AMC Count Status
router.get("/amcCountStatus", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "Start date and end date are required" });
    }

    // Get only RO Master entries with siteStatus = "AMC"
    const roMasterData = await ROMaster.find({ siteStatus: "AMC" });

    // Get all daily plans within the date range
    const dailyPlans = await DailyPlan.find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      issueType: {
        $in: ["Issue & PM Visit", "PM Visit", "ATG & PM Visit"],
      },
    });

    // Create a map to track completed AMC visits by RO Code
    const completedAMCVisits = new Map();
    dailyPlans.forEach((plan) => {
      const roCode = plan.roCode;
      if (!completedAMCVisits.has(roCode)) {
        completedAMCVisits.set(roCode, []);
      }
      completedAMCVisits.get(roCode).push(plan);
    });

    // Group by engineer
    const engineerStats = new Map();
    const detailedData = []; // For CSV export

    roMasterData.forEach((ro) => {
      const engineer = ro.engineer || "Unknown";
      const roCode = ro.roCode;
      const roName = ro.roName;
      const region = ro.region;
      const phase = ro.phase;

      if (!engineerStats.has(engineer)) {
        engineerStats.set(engineer, {
          engineerName: engineer,
          totalAMCAssigned: 0,
          totalAMCCompleted: 0,
          pendingAMC: 0,
        });
      }

      const stats = engineerStats.get(engineer);
      stats.totalAMCAssigned++;

      // Check if this RO has completed AMC visits
      const hasCompletedAMC = completedAMCVisits.has(roCode);
      if (hasCompletedAMC) {
        stats.totalAMCCompleted++;
      } else {
        stats.pendingAMC++;
      }

      // Add detailed data for CSV export
      const latestVisit = hasCompletedAMC
        ? completedAMCVisits
            .get(roCode)
            .reduce((latest, plan) =>
              new Date(plan.date) > new Date(latest.date) ? plan : latest
            )
        : null;

      detailedData.push({
        engineerName: engineer,
        roCode: roCode,
        roName: roName,
        region: region,
        phase: phase,
        amcStatus: hasCompletedAMC ? "Completed" : "Pending",
        visitDate: hasCompletedAMC ? latestVisit.date : "",
        amcQtr: amcQtr,
        issueType: hasCompletedAMC ? latestVisit.issueType : "",
      });
    });

    const result = Array.from(engineerStats.values());

    res.json({
      success: true,
      data: result,
      detailedData: detailedData,
      summary: {
        totalSites: roMasterData.length,
        totalCompleted: result.reduce(
          (sum, stat) => sum + stat.totalAMCCompleted,
          0
        ),
        totalPending: result.reduce((sum, stat) => sum + stat.pendingAMC, 0),
      },
    });
  } catch (err) {
    console.error("Error in AMC count status:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
