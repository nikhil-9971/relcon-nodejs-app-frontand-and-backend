const express = require("express");
const router = express.Router();
const OpenAI = require("openai").default;

const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const BPCLStatus = require("../models/BPCLStatus");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/ask", async (req, res) => {
  try {
    const { prompt, user } = req.body;
    let context = "";

    /* =========================
       TODAY VISITS
    ========================= */
    if (/today|aaj/i.test(prompt)) {
      const today = new Date().toISOString().slice(0, 10);
      const count = await DailyPlan.countDocuments({ date: today });

      context = `Total visits today: ${count}`;
    } else if (/pending.*task/i.test(prompt)) {

    /* =========================
       PENDING TASKS
    ========================= */
      const pending = await Task.countDocuments({ status: "Pending" });
      context = `Pending tasks count: ${pending}`;
    } else if (/engineer|mera/i.test(prompt) && user?.engineerName) {

    /* =========================
       ENGINEER VISITS
    ========================= */
      const plans = await DailyPlan.find({
        engineer: user.engineerName,
      })
        .sort({ _id: -1 })
        .limit(5);

      context =
        plans.length > 0
          ? plans
              .map((p) => `RO: ${p.roName || "NA"} | Date: ${p.date || "NA"}`)
              .join("\n")
          : "No recent visits found for this engineer.";
    } else if (/bpcl/i.test(prompt)) {

    /* =========================
       BPCL STATUS
    ========================= */
      const total = await BPCLStatus.countDocuments();
      const verified = await BPCLStatus.countDocuments({
        isVerified: true,
      });

      context = `BPCL Status Records: ${total}, Verified: ${verified}`;
    } else {
      context = "No matching data found in system.";
    }

    /* =========================
       AI RESPONSE
    ========================= */
    const systemPrompt = `
You are RELCON AI Assistant.
Rules:
- Answer ONLY using given data
- No assumptions
- Simple Hinglish / English
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

    const answer =
      response?.choices?.[0]?.message?.content ||
      "AI could not generate a response.";

    res.json({ answer });
  } catch (err) {
    console.error("AI ERROR:", err.message);
    res.json({
      answer: "⚠️ AI backend error. Please try again.",
    });
  }
});

module.exports = router;
