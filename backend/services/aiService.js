const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// Models (Ensure they are registered)
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

    // Step 1: Architect - Generate the perfect MongoDB Pipeline
    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Master Database Architect for RELCON SYSTEMS.
          Today's Date: ${todayStr}.

          DATABASE STRUCTURE (CRITICAL):
          - DailyPlan (Collection: 'dailyplans'): Fields: roCode, roName, engineer, date, completionStatus.
          - Status (Collection: 'status'): Fields: planId, spareUsed (contains material codes), earthingStatus. [Used for HPCL]
          - JioBPStatus (Collection: 'jiobpsstatuses'): Fields: planId, usedMaterialDetails (contains material codes), hpsdId.
          - BPCLStatus (Collection: 'bpclstatuses'): Fields: planId, relconAtgDetails, class1Devices.

          SEARCH RULES:
          1. Material Search (Codes like 5ER..., J0K..., 1-RF...):
             - These codes are often PART of a string (e.g., "1-RF SLAVE (5ER32505070)").
             - Use $regex with $options: "i".
             - ALWAYS $lookup with 'dailyplans' to get the RO Name and Engineer.
          
          2. Joins (Lookup):
             - Join from 'status'/'jiobpsstatuses' to 'dailyplans' using:
               { "$lookup": { "from": "dailyplans", "localField": "planId", "foreignField": "_id", "as": "planDetails" } }

          3. Formatting:
             - If the user provides a code with a dash like '5ER32505070-', clean it to '5ER32505070'.

          STRICT RESPONSE: Respond ONLY with JSON {"collection": "ModelName", "pipeline": [...]}.`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);

    // Step 2: Model Retrieval with Fallback
    const modelName = strategy.collection;
    const Model = mongoose.model(modelName);

    if (!Model) return "Database Error: Model not found.";

    // Step 3: Execute Aggregation
    const rawData = await Model.aggregate(strategy.pipeline).limit(10);

    // Step 4: Communicator - Final Answer
    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a Senior RELCON Admin. 
          Analyze the data. If 'planDetails' is present, it contains information about the site (RO Name, Code, Engineer).
          - If data is found: Tell the user EXACTLY which RO (Name & Code) used the material and which engineer did it.
          - If no data: Explain that you checked all status reports for the code but couldn't find a match.
          - Language: Hinglish (Hindi + English).`,
        },
        {
          role: "user",
          content: `Question: ${question} \nData: ${JSON.stringify(rawData)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
    });

    return communicatorCompletion.choices[0].message.content.trim();
  } catch (error) {
    console.error("DEBUG_AI_LOG:", error);
    return "Query process karne mein samasya ho rahi hai. Kripya details re-check karein.";
  }
}

module.exports = { handleAIQuery };
