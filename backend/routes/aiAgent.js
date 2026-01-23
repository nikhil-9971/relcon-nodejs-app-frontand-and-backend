const express = require("express");
const router = express.Router();
const OpenAI = require("openai");

const Plan = require("../models/plan");
const Task = require("../models/taskModel");
const Status = require("../models/statusmodel");
const Bpcl = require("../models/bpclStatusModel");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/ask", async (req, res) => {
  try {
    const { prompt, user } = req.body;

    let contextData = "";

    // 🔍 INTENT DETECTION
    if (/pending.*task/i.test(prompt)) {
      const count = await Task.countDocuments({ status: "Pending" });
      contextData = `Pending Tasks Count: ${count}`;
    } else if (/today.*visit/i.test(prompt)) {
      const today = new Date().toISOString().slice(0, 10);
      const visits = await Plan.countDocuments({ visitDate: today });
      contextData = `Today's Visits Count: ${visits}`;
    } else if (/engineer/i.test(prompt)) {
      const plans = await Plan.find({ engineerName: user.engineerName })
        .sort({ visitDate: -1 })
        .limit(5);
      contextData = plans
        .map((p) => `Site: ${p.siteName}, Date: ${p.visitDate}`)
        .join("\n");
    } else if (/bpcl/i.test(prompt)) {
      const pending = await Bpcl.countDocuments({ status: "Pending" });
      contextData = `BPCL Pending Faults: ${pending}`;
    } else {
      contextData = "No specific dataset matched.";
    }

    // 🧠 SYSTEM PROMPT
    const systemPrompt = `
You are RELCON AI Assistant.
Rules:
- Answer ONLY from provided data
- Be clear and professional
- Use simple English or Hinglish
- If data missing, say "Data not available"

Data:
${contextData}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    res.json({
      answer: completion.choices[0].message.content,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI Agent failed" });
  }
});

module.exports = router;
