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
          Today: ${todayStr}, Yesterday: ${yesterdayStr}.

          BUSINESS LOGIC:
          - If the user asks about a code like '5ER...' or 'J0K...', search in 'Status' (field: spareUsed) or 'JioBPStatus' (field: usedMaterialDetails).
          - If the question is about 'Yesterday', use date: '${yesterdayStr}'.
          - 'RBML' and 'JioBP' are the same. Use 'JioBPStatus' model.
          - 'HPCL' uses 'Status' model. 'BPCL' uses 'BPCLStatus' model.
          - For 'Count' or 'Kitne', use { "$count": "total" }.
          
          MODELS: DailyPlan, Incident, Status, BPCLStatus, JioBPStatus.
          
          STRICT RULE: Respond ONLY with JSON: {"collection": "ModelName", "pipeline": [...]}`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);
    const Model = mongoose.models[strategy.collection];
    if (!Model)
      return "I'm sorry, I couldn't access that information right now.";

    const rawData = await Model.aggregate(strategy.pipeline).limit(20);

    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a Professional Business Executive. Provide a direct answer. Never mention 'Database', 'JSON', or 'Collection'. If no records found, explain what you tried to search for.",
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
    return "The system is currently busy. Please try rephrasing your request.";
  }
}

module.exports = { handleAIQuery };
