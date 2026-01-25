const OpenAI = require("openai");
const mongoose = require("mongoose");

// Sare models load karein
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const Status = require("../models/Status");
const BPCLStatus = require("../models/BPCLStatus");
const ROMaster = require("../models/ROMaster");
const Incident = require("../models/Incident");
const MaterialRequirement = require("../models/MaterialRequirement");
const User = require("../models/User");
const atgStatus = require("../models/atgStatus");
const jioBPStatus = require("../models/jioBPStatus");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to get fields
const getSchemas = () => {
  const schemas = {
    DailyPlan: Object.keys(DailyPlan.schema.paths).join(", "),
    Task: Object.keys(Task.schema.paths).join(", "),
    ROMaster: Object.keys(ROMaster.schema.paths).join(", "),
    Incident: Object.keys(Incident.schema.paths).join(", "),
    User: Object.keys(User.schema.paths).join(", "),
  };
  return Object.entries(schemas)
    .map(([n, f]) => `${n}: ${f}`)
    .join("\n");
};

async function handleAIQuery(question) {
  try {
    const schemaDesc = getSchemas();

    // STEP 1: Select Model
    const modelStep = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Respond with only the model name (DailyPlan, Task, Status, BPCLStatus, ROMaster, Incident, MaterialRequirement, User, atgStatus, jioBPStatus) that fits the question.",
        },
        { role: "user", content: question },
      ],
      temperature: 0,
    });

    const modelName = modelStep.choices[0].message.content
      .trim()
      .replace(/[^a-zA-Z]/g, "");
    const Model = mongoose.models[modelName];

    if (!Model)
      return "I couldn't find the right data category. Please try mentioning 'Incidents' or 'RO Master'.";

    // STEP 2: Generate MongoDB Pipeline
    const pipelineStep = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a MongoDB expert. Generate a JSON aggregation array for ${modelName} using these fields: ${schemaDesc}. Respond ONLY with the JSON array. Today is ${new Date().toISOString().split("T")[0]}.`,
        },
        { role: "user", content: question },
      ],
      temperature: 0,
    });

    let rawJson = pipelineStep.choices[0].message.content.trim();
    // CLEANING: Remove markdown if AI adds it
    rawJson = rawJson
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let pipeline;
    try {
      pipeline = JSON.parse(rawJson);
    } catch (e) {
      console.error("Parse Error:", rawJson);
      return "I had trouble generating a clear query. Could you try asking in a different way?";
    }

    // STEP 3: Database Query
    const results = await Model.aggregate(pipeline).limit(10); // Limit to 10 for safety

    // STEP 4: Final Summary
    const finalStep = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Summarize the database results clearly in a user-friendly way. If results are empty, say no records found.",
        },
        {
          role: "user",
          content: `Question: ${question} \nData: ${JSON.stringify(results)}`,
        },
      ],
      temperature: 0.7,
    });

    return finalStep.choices[0].message.content.trim();
  } catch (error) {
    console.error("AI AGENT ERROR:", error);
    return "Error processing your request. Please check if the OpenAI API Key is valid.";
  }
}

module.exports = { handleAIQuery };
