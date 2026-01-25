const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// Models
const DailyPlan = require("../models/DailyPlan");
const Incident = require("../models/Incident");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/jioBPStatus");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function handleAIQuery(question) {
  try {
    // 📅 Date Logic for "Yesterday", "Today", "Tomorrow"
    const now = new Date();
    const todayStr = now.toLocaleDateString("en-GB").replace(/\//g, "-");

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday
      .toLocaleDateString("en-GB")
      .replace(/\//g, "-");

    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Lead Intelligence Officer at RELCON SYSTEMS.
          
          CONTEXT:
          - Today's Date: ${todayStr}
          - Yesterday's Date: ${yesterdayStr}
          
          COLLECTIONS & LOGIC:
          - DailyPlan: Use this for "Plans", "Visits", "Engineers schedule". 
            * If user asks for "HPCL sites plan", filter { "phase": { "$regex": "HPCL", "$options": "i" } } in DailyPlan.
            * Dates are stored as "DD-MM-YYYY" strings.
          - Incident: Use for "Pending complaints", "Total tickets".
          - Status/BPCLStatus/JioBPStatus: Use for technical site data (SIM, Earthing, Spares).

          TASKS:
          1. For "How many" (kitne), use { "$count": "total" }.
          2. For "Who" (kaun), use { "$group": { "_id": "$engineer" } } or project engineer names.
          3. Use EXACT model names: DailyPlan, Incident, Status, BPCLStatus, JioBPStatus.

          Respond ONLY with JSON: {"collection": "ModelName", "pipeline": [...]}`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);
    const Model = mongoose.models[strategy.collection];

    if (!Model) return "I'm sorry, I couldn't find that data module.";

    const rawData = await Model.aggregate(strategy.pipeline).limit(15);

    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a Senior Business Executive. Provide a direct and professional answer.
          - Never mention "Database" or "JSON".
          - If the user asks about "Yesterday", start with "Kal ke data ke mutabiq...".
          - If data is empty, say "Records mein aisi koi jankari nahi mili."`,
        },
        {
          role: "user",
          content: `Question: ${question} \nData: ${JSON.stringify(rawData)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
    });

    return communicatorCompletion.choices[0].message.content.trim();
  } catch (error) {
    return "Technically, I am unable to process this right now. Please try again.";
  }
}

module.exports = { handleAIQuery };
