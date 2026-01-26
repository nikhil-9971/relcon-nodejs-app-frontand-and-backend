const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// Saare Models Import karein
const DailyPlan = require("../models/DailyPlan");
const Incident = require("../models/Incident");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/jioBPStatus");
const Task = require("../models/Task");
const MaterialRequirement = require("../models/MaterialRequirement");

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
          content: `You are the Lead Data Scientist at RELCON SYSTEMS. 
          Current Date: ${todayStr}, Yesterday: ${yesterdayStr}.

          CORE MAPPING RULES:
          1. "Visit" / "Plan" / "Engineer work" -> Collection: 'DailyPlan'
          2. "Complaint" / "Issues" / "Ticket" -> Collection: 'Incident'
          3. "Spare" / "Material" / "Used" -> Look in 'Status' (HPCL), 'JioBPStatus' (Jio), or 'BPCLStatus'.
          4. "Pending Task" / "Follow up" -> Collection: 'Task'
          5. "Dispatch" / "Material Request" -> Collection: 'MaterialRequirement'

          QUERY CONSTRUCTION RULES:
          - For dates: Always use the format 'DD-MM-YYYY' (e.g., 24-01-2026).
          - For names/regions: Use { "$regex": "name", "$options": "i" } for flexible searching.
          - If the user asks "How many" or "Count", use { "$count": "total" }.
          - To get full details of a visit including spares, use $lookup to join 'DailyPlan' with 'Status' (on planId).

          DATABASE SCHEMA HINTS:
          - DailyPlan: roCode, roName, engineer, region, date, completionStatus.
          - Incident: incidentId, roCode, status, complaintRemark.
          - Status/JioBPStatus: planId, spareUsed, usedMaterialDetails.

          STRICT RESPONSE: ONLY JSON {"collection": "ModelName", "pipeline": [...]}. No explanation.`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile", // Powerful model for logic
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);

    // Dynamically select model
    const Model =
      mongoose.models[strategy.collection] ||
      mongoose.model(strategy.collection);

    // Execute Data Fetching
    const rawData = await Model.aggregate(strategy.pipeline).limit(20);

    // Communicator: Converts Data to Human Language
    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a Senior RELCON Executive. 
          - Give a clear, direct answer based on the data provided.
          - If data is empty [], say exactly what you searched for (e.g., "I checked the records for 24-01-2026 but no visits were planned for that day.")
          - Use Hindi-English mix (Hinglish) if the user asks in Hindi.
          - Never mention "pipeline", "database", or "collection".`,
        },
        {
          role: "user",
          content: `User Question: ${question} \nDatabase Result: ${JSON.stringify(rawData)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.5,
    });

    return communicatorCompletion.choices[0].message.content.trim();
  } catch (error) {
    console.error("SuperAI Error:", error);
    return "Maaf kijiye, system me thodi takniki kharabi hai. Kripya thodi der baad koshish karein.";
  }
}

module.exports = { handleAIQuery };
