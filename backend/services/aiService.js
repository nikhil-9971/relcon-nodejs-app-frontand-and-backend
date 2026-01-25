const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require("mongoose");

// Models import
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const ROMaster = require("../models/ROMaster");
const Incident = require("../models/Incident");
const User = require("../models/User");

// GEMINI_API_KEY Render ke Environment Variables mein check karein
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    // FIX: "gemini-1.5-flash" ki jagah "gemini-pro" use karein (zyada stable hai)
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const schemaDesc = getSchemas();

    // 1. SELECT MODEL
    const modelPrompt = `Respond with ONLY the Mongoose model name (DailyPlan, Task, ROMaster, Incident, User) for this question: "${question}".`;
    const modelResult = await model.generateContent(modelPrompt);
    const modelName = modelResult.response
      .text()
      .trim()
      .replace(/[^a-zA-Z]/g, "");

    const Model = mongoose.models[modelName];
    if (!Model)
      return "I couldn't identify the right category. Try asking about visits, tasks, or incidents.";

    // 2. GENERATE PIPELINE
    const pipelinePrompt = `
      You are a MongoDB expert. Generate a JSON aggregation pipeline array for model "${modelName}" with fields: ${schemaDesc}.
      Today's date: ${new Date().toISOString().split("T")[0]}.
      User Question: "${question}"
      Respond with ONLY the JSON array. Do not include markdown or backticks.
    `;
    const pipelineResult = await model.generateContent(pipelinePrompt);
    let rawJson = pipelineResult.response.text().trim();

    // Cleaning the JSON
    rawJson = rawJson
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let pipeline;
    try {
      pipeline = JSON.parse(rawJson);
    } catch (e) {
      return "I generated an invalid query. Please try asking again.";
    }

    // 3. FETCH DATA
    const results = await Model.aggregate(pipeline).limit(5);

    // 4. FINAL ANSWER
    const summaryPrompt = `
      Question: "${question}"
      Results: ${JSON.stringify(results)}
      Summarize this in a simple, friendly sentence. If no data, say no records found.
    `;
    const finalResult = await model.generateContent(summaryPrompt);
    return finalResult.response.text().trim();
  } catch (error) {
    console.error("GEMINI ERROR:", error);
    return (
      "AI error: " +
      (error.message.includes("404")
        ? "Model not found. Use gemini-pro instead."
        : error.message)
    );
  }
}

module.exports = { handleAIQuery };
