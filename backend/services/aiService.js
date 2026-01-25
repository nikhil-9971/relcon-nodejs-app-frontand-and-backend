const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// --- Models Loading ---
const DailyPlan = require("../models/DailyPlan");
const Incident = require("../models/Incident");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/jioBPStatus");
const Task = require("../models/Task");
const ROMaster = require("../models/ROMaster");
const MaterialRequirement = require("../models/MaterialRequirement");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function handleAIQuery(question) {
  try {
    const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    // Stage 1: The Architect (Decision Maker)
    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Master Intelligence of RELCON SYSTEMS. Today is ${today}.
          
          COLLECTIONS & KEY FIELDS:
          - DailyPlan: visits, engineer work, date, roCode.
          - Incident: roCode, incidentId, status (Pending/Closed), complaintRemark.
          - Status: HPCL data, spareUsed (for material search), earthingStatus, sim1Number.
          - JioBPStatus: Jio/RBML data, usedMaterialDetails (for material search), diagnosis.
          - ROMaster: site details, zone, region, roCode.

          SEARCH RULES:
          1. If the user asks "How many" or "kitne", use { "$count": "total" } stage at the end.
          2. If a specific code (like 5ER...) is mentioned, use $or with $regex on fields like 'spareUsed', 'usedMaterialDetails', 'whatDone', 'incidentId'.
          3. RO Codes must be Strings.
          4. For "Last visit", sort by _id: -1.
          5. ALWAYS use $regex with $options: 'i' for text/material searches.
          6. Model names must be EXACT: DailyPlan, Incident, Status, BPCLStatus, JioBPStatus, Task, ROMaster, MaterialRequirement.

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

    if (!Model) {
      return "I'm sorry, I couldn't access that specific data module. Could you please rephrase?";
    }

    // Execution
    let rawData = await Model.aggregate(strategy.pipeline).limit(10);

    // Stage 2: The Communicator (Business Response)
    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a Senior Manager at RELCON. 
          Summarize the data for the end user professionally.
          - NEVER mention "Collection", "Pipeline", "Model", or "Database".
          - If the data is a count, just say "Total records found are X".
          - If the data is a list, format it clearly with RO Name and Date.
          - If no data is found, say: "Mujhe aapke query ke liye koi record nahi mila. Kripya details check karein."`,
        },
        {
          role: "user",
          content: `User Question: ${question} \nFound Data: ${JSON.stringify(rawData)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
    });

    return communicatorCompletion.choices[0].message.content.trim();
  } catch (error) {
    console.error("AI SYSTEM ERROR:", error);
    return "Maaf kijiye, main abhi ye information nahi nikal paa raha hu. Kripya thodi der baad koshish karein.";
  }
}

module.exports = { handleAIQuery };
