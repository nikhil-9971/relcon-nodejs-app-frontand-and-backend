const express = require("express");
const router = express.Router();
const OpenAI = require("openai").default;

const DailyPlan = require("../models/DailyPlan");
const Status = require("../models/Status");
const Task = require("../models/Task");
const BPCLStatus = require("../models/BPCLStatus");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/ask", async (req, res) => {
  try {
    const { prompt, user } = req.body;

    let context = "";

    // 🔍 TODAY VISITS
    if (/today|aaj/i.test(prompt)) {
      const today = new Date().toISOString().slice(0, 10);
      const count = await DailyPlan.countDocuments({ visitDate: today });
      context = `Today's total visits: ${count}`;
    }

    // 🔍 PENDING TASK
    else if (/pending.*task/i.test(prompt)) {
      const pending = await Task.countDocuments({ status: "Pending" });
      context = `Pending tasks: ${pending}`;
    }

    // 🔍 ENGINEER DATA
    else if (/engineer|mera/i.test(prompt) && user?.engineerName) {
      const data = await DailyPlan.find({ engineerName: user.engineerName })
        .sort({ visitDate: -1 })
        .limit(5);

      context = data
        .map((d) => `Site: ${d.siteName}, Date: ${d.visitDate}`)
        .join("\n");
    }

    // 🔍 BPCL FAULT
    else if (/bpcl/i.test(prompt)) {
      const bpclPending = await BPCLStatus.countDocuments({
        status: "Pending",
      });
      context = `BPCL pending faults: ${bpclPending}`;
    } else {
      context = "No matching data found";
    }

    // 🧠 SYSTEM PROMPT
    const systemPrompt = `
You are RELCON AI Assistant.
Rules:
- Answer only using given data
- No guessing
- Simple English or Hinglish
Data:
${context}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    res.json({ answer: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI processing failed" });
  }
});

module.exports = router;
