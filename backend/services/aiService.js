const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// --- All Models Required ---
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/JioBPStatus");
const Incident = require("../models/Incident");
const MaterialRequirement = require("../models/MaterialRequirement");
const ROMaster = require("../models/ROMaster");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * 💡 AI Core Knowledge Base
 * Mapping business terms to database realities
 */
const getBusinessLogic = () => {
  return `
    - "Visits", "Schedules", "Engineer movement" -> DailyPlan (date format: DD-MM-YYYY)
    - "Complaints", "Issues", "Pending work" -> Incident (status: Pending/Closed)
    - "HPCL Sites", "SIM info", "Earthing/Voltage", "DU/Tank Offline" -> Status
    - "BPCL Sites", "IOT Devices", "ATG Provided" -> BPCLStatus
    - "JioBP", "RBML", "HPSD", "Diagnosis" -> JioBPStatus
    - "Follow-ups", "Resolved tasks" -> Task
    - "Stocks", "Dispatch" -> MaterialRequirement
    - "Site Master", "Zones", "Regions" -> ROMaster
  `;
};

async function handleAIQuery(question) {
  try {
    const today = new Date();
    const formattedToday = today
      .toLocaleDateString("en-GB")
      .replace(/\//g, "-"); // DD-MM-YYYY

    // Stage 1: The Architect (Generates the Query)
    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Master Brain of RELCON SYSTEMS. You solve complex business queries.
          Today is ${formattedToday}.
          
          BUSINESS DATA MAP:
          ${getBusinessLogic()}

          STRICT INSTRUCTIONS:
          1. Use $regex for date strings (DD-MM-YYYY).
          2. For case-insensitive searches, use $options: 'i'.
          3. Always return a JSON object with "collection" and "pipeline".
          4. NEVER reveal the collection names or technical logic to the user.
          5. If a query requires joining DailyPlan with Status, use $lookup.
          
          Format: {"collection": "ModelName", "pipeline": [...]}`,
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
      return "I'm sorry, I couldn't access that specific data. Could you rephrase your request?";
    }

    // Execution
    const rawData = await Model.aggregate(strategy.pipeline).limit(15);

    // Stage 2: The Professional Communicator (Humanizes the Response)
    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Professional AI Assistant for RELCON SYSTEMS. 
          Your goal is to provide a clean, executive summary of the data.
          
          RULES:
          1. NEVER mention words like "Database", "Model", "JSON", "Collection", "Pipeline", or "Aggregate".
          2. Use professional business language (English + Hindi if helpful).
          3. If data is a list, use bullet points.
          4. If no data found, say "No records were found for this period" instead of "Empty array".
          5. If asked about a specific person, summarize their work.`,
        },
        {
          role: "user",
          content: `Original Question: ${question} \nFound Data: ${JSON.stringify(rawData)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
    });

    return communicatorCompletion.choices[0].message.content.trim();
  } catch (error) {
    console.error("AI SYSTEM ERROR:", error);
    return "I apologize, I'm currently unable to retrieve that information. Please check back in a moment.";
  }
}

module.exports = { handleAIQuery };
