const express = require("express");
const router = express.Router();

const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const Status = require("../models/Status");

router.post("/ask", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message required" });
    }

    const msg = message.toLowerCase();

    // 🔹 VISIT COUNT
    if (msg.includes("visit")) {
      const today = new Date().toISOString().split("T")[0];

      const count = await DailyPlan.countDocuments({
        scheduleDate: today,
      });

      return res.json({
        reply: `Aaj total ${count} visit plan hue hain.`,
      });
    }

    // 🔹 PENDING TASK
    if (msg.includes("pending")) {
      const pending = await Task.countDocuments({
        status: "Pending",
      });

      return res.json({
        reply: `Total ${pending} pending tasks hain.`,
      });
    }

    // 🔹 INCIDENT / STATUS
    if (msg.includes("incident")) {
      const open = await Status.countDocuments({
        status: "Open",
      });

      return res.json({
        reply: `Currently ${open} open incidents hain.`,
      });
    }

    // 🔹 DEFAULT
    return res.json({
      reply:
        "Main visit, task aur incident related help kar sakta hoon. Kripya clear poochhein 🙂",
    });
  } catch (err) {
    console.error("AI Agent Error:", err);
    res.status(500).json({
      reply: "AI backend error. Please try again.",
    });
  }
});

module.exports = router;
