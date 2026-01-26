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

    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Lead Data Architect at RELCON SYSTEMS.
          
          CORE SEARCH STRATEGY:
          1. MATERIAL CODES (e.g., '5ER...', 'J0K...', '1-RF...'): 
             - These are inside long strings. ALWAYS use {"$regex": "code", "$options": "i"}.
             - Search in: Status (spareUsed), JioBPStatus (usedMaterialDetails), BPCLStatus (class1Devices, relconAtgDetails).
          
          2. LINKING DATA (Very Important):
             - Status/JioBPStatus/BPCLStatus models only have 'planId'. 
             - To get RO Name, Engineer Name, or Date, you MUST use $lookup with 'dailyplans' collection.
          
          3. MODELS & FIELDS:
             - DailyPlan: roCode, roName, engineer, date.
             - Status: spareUsed, iemiNumber, connectivityType.
             - JioBPStatus: usedMaterialDetails, hpsdId.
             - BPCLStatus: class1Devices, relconAtgDetails.

          EXAMPLE PIPELINE FOR MATERIAL SEARCH:
          [
            { "$match": { "spareUsed": { "$regex": "5ER32505070", "$options": "i" } } },
            { "$lookup": { "from": "dailyplans", "localField": "planId", "foreignField": "_id", "as": "plan" } },
            { "$unwind": "$plan" }
          ]

          STRICT RULE: Respond ONLY with JSON: {"collection": "ModelName", "pipeline": [...]}.`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);

    // Model selection logic
    let Model = mongoose.models[strategy.collection];
    if (!Model) return "System initialization error.";

    // Execute aggregation
    const rawData = await Model.aggregate(strategy.pipeline).limit(10);

    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a Senior RELCON Executive. 
          Analyze the provided data and answer the user's question. 
          - If the data has a 'plan' object (from lookup), mention the RO Name, RO Code, and Engineer.
          - If no records found, explain: "Maine sabhi records (HPCL, JioBP, BPCL) mein '5ER...' code dhoondha, lekin koi match nahi mila."
          - Be precise. Use Hinglish if appropriate.`,
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
    console.error("AI_CORE_ERROR:", error);
    return "Query process karne mein dikkat aa rahi hai. Kripya code ya RO name sahi se likhein.";
  }
}

module.exports = { handleAIQuery };
