const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// Models
const DailyPlan = require("../models/DailyPlan");
const Incident = require("../models/Incident");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const JioBPStatus = require("../models/jioBPStatus");
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
          
          MODELS:
          - DailyPlan: { roCode (String), roName, date (DD-MM-YYYY), engineer, whatDone, completionStatus }
          - Incident: { roCode (String), incidentId, status, complaintRemark }
          - Status: { planId, sim1Number, earthingStatus }
          - ROMaster: { roCode (String), roName, region, phase }

          CRITICAL RULES:
          1. RO Code MUST be a String in $match. Example: { "roCode": "13872800" }.
          2. For "last visit", match the roCode, then sort by _id descending (as it's more reliable than string dates).
          3. If searching by date string, use $regex.
          4. Return ONLY JSON: {"collection": "ModelName", "pipeline": [...]}`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const strategy = JSON.parse(architectCompletion.choices[0].message.content);

    // Debugging: Terminal logs mein pipeline check karne ke liye
    console.log("AI Collection:", strategy.collection);
    console.log("AI Pipeline:", JSON.stringify(strategy.pipeline));

    const Model = mongoose.models[strategy.collection];
    if (!Model) return "System busy. Please try rephrasing.";

    const rawData = await Model.aggregate(strategy.pipeline).limit(5);

    // Agar data nahi mila toh AI ko ek chance aur dena detail batane ke liye
    if (!rawData || rawData.length === 0) {
      return `Mujhe RO Code ${question.match(/\d+/)} ke liye koi record nahi mila. Kripya check karein ki RO Code sahi hai ya nahi.`;
    }

    const communicatorCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a professional RELCON assistant. Summarize the data. If multiple visits, mention the latest one first. Do not mention technical terms like JSON or Pipeline.",
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
    return "Something went wrong while fetching data. Please try again.";
  }
}

module.exports = { handleAIQuery };
