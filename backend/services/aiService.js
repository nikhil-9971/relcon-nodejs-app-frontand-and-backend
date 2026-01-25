const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// --- Ensure all models are loaded ---
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/jioBPStatus");
const Incident = require("../models/Incident");
const MaterialRequirement = require("../models/MaterialRequirement");
const ROMaster = require("../models/ROMaster");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function handleAIQuery(question) {
  try {
    const today = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    // Stage 1: The Architect (Smart Query Generation)
    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Lead Data Analyst for RELCON SYSTEMS. Today is ${today}.
          
          VALID MODELS (Use EXACT names):
          - DailyPlan: For visits, engineer schedules, work done, and "last visit" queries.
          - Incident: For complaints, tickets, pending/closed status.
          - Status: For HPCL site details (earthing, voltage, SIM, DU offline).
          - BPCLStatus: For BPCL site details (IOT devices, ATG).
          - JioBPStatus: For JioBP/RBML diagnosis and solution.
          - Task: For follow-ups and mailed issues.
          - ROMaster: For site master data (zone, region, status).

          RULES:
          1. Identify the BEST model from the list above.
          2. Use $regex for RO Code or text search.
          3. If asking for "last visit", sort by 'date' descending in pipeline.
          4. RO Code ${question.match(/\d+/)} should be treated as a string in $match.
          
          RESPONSE FORMAT (JSON ONLY):
          {"collection": "EXACT_MODEL_NAME", "pipeline": [...]}`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);

    // --- SAFE MODEL LOADING ---
    const modelName = strategy.collection.trim();
    const Model = mongoose.models[modelName];

    if (!Model) {
      console.error(`ERROR: AI chose invalid model: ${modelName}`);
      return "I apologize, but I couldn't retrieve that information. Could you please specify if you're asking about a visit, an incident, or site status?";
    }

    // Execution
    const rawData = await Model.aggregate(strategy.pipeline).limit(10);

    // Stage 2: Communicator (Hide Technicals)
    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a Professional Assistant. Summarize data for the user.
          RULES:
          1. NEVER mention "Database", "Model", "JSON", or "Pipeline".
          2. If data is found, present it clearly.
          3. If no data, say: "No records were found for the requested information."`,
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
    console.error("AI SYSTEM ERROR:", error);
    return "I am sorry, I am currently having trouble accessing the records. Please try again in a moment.";
  }
}

module.exports = { handleAIQuery };
