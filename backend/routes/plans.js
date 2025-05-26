const express = require("express");
const router = express.Router();
const DailyPlan = require("../models/DailyPlan");
const Status = require("../models/Status");

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
router.get("/getDailyPlans", async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");
  const { role, engineerName } = req.session.user;

  try {
    const plans =
      role === "admin"
        ? await DailyPlan.find({})
        : await DailyPlan.find({ engineer: engineerName });

    const statusList = await Status.find({});
    const statusMap = new Map(
      statusList.map((s) => [s.planId.toString(), true])
    );

    const enrichedPlans = plans.map((plan) => {
      const planObj = plan.toObject();
      planObj.statusSaved = statusMap.has(plan._id.toString());
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
    res.json(plan);
  } catch (err) {
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

module.exports = router;
