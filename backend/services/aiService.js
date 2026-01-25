const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// Models
const DailyPlan = require("../models/DailyPlan");
const Incident = require("../models/Incident");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/JioBPStatus");
const Task = require("../models/Task");
const ROMaster = require("../models/ROMaster");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function handleAIQuery(question) {
  try {
    const todayDate = new Date()
      .toLocaleDateString("en-GB")
      .replace(/\//g, "-");

    const architectCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are the Lead Analyst for RELCON. Today: ${todayDate}.
          
          MODELS (Use EXACT names):
          - DailyPlan: { roCode (String), roName, date (DD-MM-YYYY), engineer, whatDone, completionStatus }
          - Incident: { roCode (String), incidentId, status (String: Pending, Closed), complaintRemark }
          - Status: { planId, sim1Number, earthingStatus }
          - ROMaster: { roCode (String), roName, region, phase }
          // Add other relevant models and their key fields here if needed.

          CRITICAL RULES:
          1. If the question asks for a count (e.g., "kitne", "total", "how many"), generate a {$count: "total"} stage at the end of the pipeline.
          2. If the question is generic (e.g., "Pending Incident kitne h"), DO NOT force a "roCode" match unless explicitly mentioned.
          3. RO Code in $match MUST be a String. Example: { "roCode": "13872800" }.
          4. For "last visit", match the roCode, then sort by _id descending (reliable for chronological order).
          5. If searching by date string, use $regex for partial matching.
          6. For status fields like Incident.status, use exact string match (e.g., "Pending").
          7. Return ONLY JSON: {"collection": "ModelName", "pipeline": [...]}`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);

    console.log("AI Collection:", strategy.collection);
    console.log("AI Pipeline:", JSON.stringify(strategy.pipeline));

    const Model = mongoose.models[strategy.collection];
    if (!Model) return "System busy. Please try rephrasing.";

    const rawData = await Model.aggregate(strategy.pipeline).limit(
      strategy.pipeline.some((s) => "$count" in s) ? 1 : 10,
    ); // If count, limit 1. Else 10.

    // Agar data nahi mila aur AI ne RO Code ke bina query banayi thi
    if (!rawData || rawData.length === 0) {
      if (question.toLowerCase().includes("ro code")) {
        // User ne RO Code mention kiya tha, fir bhi nahi mila
        return `Mujhe RO Code ${question.match(/\d+/)} ke liye koi record nahi mila. Kripya check karein ki RO Code sahi hai ya nahi.`;
      } else {
        // User ne RO Code mention nahi kiya tha, aur generic query ka answer nahi mila
        return `Sorry, no records were found for your request. Perhaps you can be more specific, or mention an RO Code if applicable.`;
      }
    }

    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a professional RELCON assistant. Summarize the data. If multiple records, highlight key findings. If a count, state it directly. Do not mention technical terms like JSON or Pipeline.",
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
