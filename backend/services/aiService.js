const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// --- Models Import ---
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const Status = require("../models/Status"); // HPCL Status
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/jioBPStatus");
const Incident = require("../models/Incident");
const MaterialRequirement = require("../models/MaterialRequirement");
const ROMaster = require("../models/ROMaster");
const User = require("../models/User");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Sabhi models ke fields ko AI ko samjhane ke liye detail helper
const getFullContext = () => {
  const schemas = {
    DailyPlan:
      "Visits, roCode, roName, engineer, date, purpose, arrivalTime, leaveTime, completionStatus. (Main Model for visits)",
    Status:
      "HPCL sites details: probeMake, probeSize, sim1Number, sim2Number, earthingStatus, voltageReading, duOffline, tankOffline, oms03. (HPCL Specific)",
    BPCLStatus:
      "BPCL sites: class1DeviceCount, class2DeviceCount, relconAtgProvided, jioSimNumber, airtelSimNumber. (BPCL Specific)",
    JioBPStatus:
      "JioBP/RBML sites: hpsdId, diagnosis, solution, activeMaterialUsed, oms03, status. (JioBP Specific)",
    Incident:
      "Complaints: roCode, incidentId, incidentDate, status (Pending/Closed), complaintRemark, closeRemark.",
    Task: "Follow-ups: roCode, issue, status, emailContent, followUpDates, duRemark, tankRemark.",
    MaterialRequirement:
      "Stock/Material: material, materialDispatchStatus, materialRequestDate, engineer, roCode.",
    ROMaster:
      "Master Data: zone, region, roCode, roName, phase, siteStatus, siteActivestatus.",
  };
  return Object.entries(schemas)
    .map(([n, d]) => `[${n}]: ${d}`)
    .join("\n");
};

async function handleAIQuery(question) {
  try {
    const context = getFullContext();
    const today = new Date().toISOString().split("T")[0];

    // STEP 1: Think and Generate Query
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Lead Data Analyst for RELCON SYSTEMS. 
          Today's Date: ${today}.
          
          COLLECTIONS KNOWLEDGE:
          ${context}

          CRITICAL RULES:
          1. For questions about HPCL, use 'Status' model.
          2. For questions about BPCL, use 'BPCLStatus' model.
          3. For questions about Jio/RBML, use 'JioBPStatus' model.
          4. For visits/schedules, use 'DailyPlan'.
          5. Many dates in DB are STRINGS (DD-MM-YYYY). Use $regex for partial date matching.
          6. Use 'i' in $regex for case-insensitive text search.

          Response Format (Strict JSON):
          {"model": "ModelName", "pipeline": [...], "explanation": "Why you chose this"}
          `,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const aiPlan = JSON.parse(completion.choices[0].message.content);
    console.log("AI Strategy:", aiPlan.explanation);

    const Model = mongoose.models[aiPlan.model];
    if (!Model)
      return `Model '${aiPlan.model}' not found. Please ask specifically about HPCL, BPCL, Jio, or Plans.`;

    // STEP 2: Execute Aggregation
    const results = await Model.aggregate(aiPlan.pipeline).limit(10);

    // STEP 3: Humanize the Data
    const summary = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Translate the database JSON into a clear, professional English/Hindi mixed response. Format as a list if multiple records. If no data, explain what you searched for but found nothing.",
        },
        {
          role: "user",
          content: `Question: ${question} \nDatabase Results: ${JSON.stringify(results)} \nContext: Used Model ${aiPlan.model}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
    });

    return summary.choices[0].message.content.trim();
  } catch (error) {
    console.error("POWERFUL AI ERROR:", error);
    return "Maaf kijiye, database query generate karne mein issue aaya. Kripya sawaal thoda aur detail mein puchein (jaise RO Code mention karein).";
  }
}

module.exports = { handleAIQuery };
