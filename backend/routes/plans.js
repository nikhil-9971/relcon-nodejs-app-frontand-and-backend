const express = require("express");
const router = express.Router();
const DailyPlan = require("../models/DailyPlan");
const Status = require("../models/Status");
const verifyToken = require("../middleware/authMiddleware");
const JioBPStatus = require("../models/jioBPStatus");
const User = require("../models/User");

// ✅ Save Daily Plan
router.post("/saveDailyPlan", async (req, res) => {
  try {
    const plan = new DailyPlan(req.body);
    await plan.save();
    res.send("✅ Plan saved!");
  } catch (error) {
    res.status(500).send("❌ Error saving plan: " + error.message);
  }
});

// ✅ Check for Duplicate Daily Plan by roCode and date
router.get("/checkDuplicate", async (req, res) => {
  try {
    const { roCode, date, engineer } = req.query;
    if (!roCode || !date)
      return res.status(400).send("Missing roCode or date or engineer");

    const duplicate = await DailyPlan.findOne({
      roCode: roCode.toUpperCase().trim(),
      date: date.trim(),
      engineer: engineer.trim(),
    });

    if (duplicate) {
      res.json({ duplicate: true });
    } else {
      res.json({ duplicate: false });
    }
  } catch (err) {
    console.error("Error checking duplicate:", err);
    res.status(500).send("Server error");
  }
});

// ✅ Get All Plans with statusSaved flag
router.get("/getDailyPlans", verifyToken, async (req, res) => {
  const { role, engineerName } = req.user;

  try {
    const plans =
      role === "admin"
        ? await DailyPlan.find({})
        : await DailyPlan.find({ engineer: engineerName });

    const statusList = await Status.find({});
    const statusMap = new Map(
      statusList.map((s) => [s.planId.toString(), true])
    );

    const jioStatusList = await JioBPStatus.find({});
    const jioStatusMap = new Map(
      jioStatusList.map((s) => [s.planId.toString(), true])
    );

    const enrichedPlans = plans.map((plan) => {
      const planObj = plan.toObject();
      planObj.statusSaved = statusMap.has(plan._id.toString());
      planObj.jioBPStatusSaved = jioStatusMap.has(plan._id.toString());
      return planObj;
    });

    res.json(enrichedPlans);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// ✅ NEW: Get a single Daily Plan by ID
router.get("/getPlanById/:id", async (req, res) => {
  try {
    const plan = await DailyPlan.findById(req.params.id);
    if (!plan) return res.status(404).send("Plan not found");

    // ✅ Enrich with status flags
    const statusExists = await Status.exists({ planId: plan._id });
    const jioStatusExists = await JioBPStatus.exists({ planId: plan._id });

    const planObj = plan.toObject();
    planObj.statusSaved = !!statusExists;
    planObj.jioBPStatusSaved = !!jioStatusExists;

    res.json(planObj);
  } catch (err) {
    console.error("Error in /getPlanById/:id:", err);
    res.status(500).send("Server error");
  }
});

// ✅ NEW: Get status record by plan ID
router.get("/getStatusByPlan/:id", async (req, res) => {
  try {
    const status = await Status.findOne({ planId: req.params.id });
    if (!status) return res.status(404).send("Status not found");
    res.json(status);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

//Plan edit
router.put("/updateDailyPlan/:id", async (req, res) => {
  try {
    const updated = await DailyPlan.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).send("Plan not found");
    res.send("✅ Record updated");
  } catch (err) {
    console.error("Error updating plan:", err);
    res.status(500).send("Server error");
  }
});

router.delete("/deleteDailyPlan/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await DailyPlan.deleteOne({ _id: id }); // Adjust model name as needed
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

//Completion Status added
router.put("/updateCompletion/:id", async (req, res) => {
  try {
    const { completionStatus } = req.body;
    const updated = await DailyPlan.findByIdAndUpdate(
      req.params.id,
      { completionStatus },
      { new: true }
    );
    if (!updated) return res.status(404).send("Plan not found");
    res.send("✅ Completion status updated");
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// ✅ Get empId by engineer name
router.get("/getEmpId/:engineerName", async (req, res) => {
  try {
    const { engineerName } = req.params;
    const user = await User.findOne({ engineerName: engineerName.trim() });
    if (user) {
      res.json({ empId: user.empId || "" });
    } else {
      res.status(404).json({ empId: "" });
    }
  } catch (err) {
    console.error("❌ Error fetching empId:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Get Last Visit by RO Code
router.get("/getLastVisit/:roCode", async (req, res) => {
  try {
    const { roCode } = req.params;

    // Find latest plan by roCode (sorted by date descending)
    const lastVisit = await DailyPlan.findOne({
      roCode: roCode.toUpperCase().trim(),
    }).sort({ date: -1 });

    if (!lastVisit) {
      return res.json({ lastDate: "", lastPurpose: "" });
    }

    res.json({
      lastDate: lastVisit.date,
      lastPurpose: lastVisit.purpose,
    });
  } catch (err) {
    console.error("❌ Error fetching last visit:", err);
    res.status(500).send("Server error");
  }
});

module.exports = router;
