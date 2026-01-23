const express = require("express");
const router = express.Router();

const DailyPlan = require("./models/DailyPlan");
const Task = require("./models/Task");
const Status = require("./models/Status");
const BPCLStatus = require("./models/BPCLStatus");

// helper – today date
function todayDate() {
  return new Date().toISOString().split("T")[0];
}

router.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ reply: "Question missing" });
    }

    const q = question.toLowerCase();
    let reply = "Sorry, samajh nahi aaya 😐";

    /* ---------------- VISIT COUNT ---------------- */
    if (q.includes("visit")) {
      const today = todayDate();

      const count = await DailyPlan.countDocuments({
        scheduleDate: today,
      });

      reply = `📍 Aaj total ${count} visits planned hain.`;
    } else if (q.includes("pending")) {

    /* ---------------- PENDING TASK ---------------- */
      const pending = await Task.countDocuments({
        status: "Pending",
      });

      reply = `⏳ Abhi ${pending} pending tasks hain.`;
    } else if (q.includes("incident")) {

    /* ---------------- INCIDENT STATUS ---------------- */
      const open = await BPCLStatus.countDocuments({ status: "Open" });
      const closed = await BPCLStatus.countDocuments({ status: "Closed" });

      reply = `🚨 Incident Status:\nOpen: ${open}\nClosed: ${closed}`;
    } else if (q.includes("ro")) {

    /* ---------------- RO DETAILS ---------------- */
      const roCount = await DailyPlan.distinct("roCode");
      reply = `🏭 Total active RO: ${roCount.length}`;
    } else if (q.includes("status")) {

    /* ---------------- STATUS UPDATED ---------------- */
      const today = todayDate();
      const updated = await Status.countDocuments({ date: today });

      reply = `✅ Aaj ${updated} status update hue hain.`;
    }

    res.json({ reply });
  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).json({
      reply: "⚠ AI backend error. Please try again.",
    });
  }
});

module.exports = router;
