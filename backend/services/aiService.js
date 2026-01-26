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
    const todayStr = now.toLocaleDateString("en-GB").replace(/\//g, "-"); // DD-MM-YYYY
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("en-GB").replace(/\//g, "-");

    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Senior Database Architect at RELCON SYSTEMS. 
          Today's Date: ${todayStr}, Yesterday: ${yesterdayStr}.

          KNOWLEDGE BASE & RELATIONSHIPS:
          1. DailyPlan: Master collection (roCode, roName, engineer, date, completionStatus).
          2. Status: HPCL data. Linked to DailyPlan via 'planId'. Fields: spareUsed, earthingStatus, oms03, iemiNumber.
          3. BPCLStatus: BPCL data. Linked to DailyPlan via 'planId'. Fields: class1Devices, relconAtgDetails.
          4. JioBPStatus: JioBP/RBML data. Linked to DailyPlan via 'planId'. Fields: usedMaterialDetails, hpsdId.
          5. Incident: Complaint records (incidentId, status, complaintRemark).
          6. Task: Pending follow-ups (issue, status, roName).
          7. MaterialRequirement: Spare requests (material, materialDispatchStatus).

          QUERY LOGIC:
          - If user asks for "Engineer's work" or "Spares used", use $lookup to join DailyPlan with Status/JioBPStatus/BPCLStatus.
          - For codes like '5ER...' or 'J0K...', search in 'Status.spareUsed' or 'JioBPStatus.usedMaterialDetails' or 'BPCLStatus.class1Devices'.
          - For 'Count', 'Kitne', 'Total', use { "$count": "total" }.
          - Use $regex with 'i' for names/cities to avoid case-sensitivity.

          STRICT RULE: Respond ONLY with a valid JSON: {"collection": "ModelName", "pipeline": [...]}.`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);
    
    // Get Model Dynamically
    const Model = mongoose.model(strategy.collection);
    if (!Model) return "Database module not found.";

    // Execute Pipeline
    const rawData = await Model.aggregate(strategy.pipeline).limit(15);

    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a Professional Business Executive. Use the provided database data to answer the user's question directly. If data is empty, explain what you searched for (e.g., 'I couldn't find any records for RO Code X on date Y'). Keep it concise and professional.",
        },
        {
          role: "user",
          content: `Question: ${question} \nData: ${JSON.stringify(rawData)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
    });

    return communicatorCompletion.choices[0].message.content.trim();
  } catch (error) {
    console.error("AI_ERROR:", error);
    return "I'm having trouble accessing the reports right now. Please try again with more specific details.";
  }
}

module.exports = { handleAIQuery };