const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require("mongoose");

// Models import
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const ROMaster = require("../models/ROMaster");
const Incident = require("../models/Incident");
const User = require("../models/User");
// Baki models bhi import kar sakte hain...

// Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    // 1. SELECT MODEL
    const modelPrompt = `Which Mongoose model name (DailyPlan, Task, ROMaster, Incident, User) is best for this question: "${question}"? Respond with ONLY the word.`;
    const modelResult = await model.generateContent(modelPrompt);
    const modelName = modelResult.response
      .text()
      .trim()
      .replace(/[^a-zA-Z]/g, "");

    const Model = mongoose.models[modelName];
    if (!Model)
      return "I'm not sure which data to look for. Try asking about visits, tasks, or incidents.";

    // 2. GENERATE MONGODB PIPELINE
    const pipelinePrompt = `
      You are a MongoDB expert. Generate a JSON aggregation pipeline array for the model "${modelName}" with fields: ${schemaDesc}.
      User Question: "${question}"
      Today's date is ${new Date().toISOString().split("T")[0]}.
      Respond ONLY with the JSON array. No markdown, no backticks.
    `;
    const pipelineResult = await model.generateContent(pipelinePrompt);
    let rawJson = pipelineResult.response.text().trim();

    // Cleaning
    rawJson = rawJson
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let pipeline;
    try {
      pipeline = JSON.parse(rawJson);
    } catch (e) {
      console.error("Gemini JSON Error:", rawJson);
      return "I encountered an error formatting the query. Please try again.";
    }

    // 3. DB QUERY
    const results = await Model.aggregate(pipeline).limit(5);

    // 4. FINAL SUMMARY
    const summaryPrompt = `
      Question: "${question}"
      Data from Database: ${JSON.stringify(results)}
      Summarize this data into a professional and friendly answer for the user. If no data, say no records found.
    `;
    const finalResult = await model.generateContent(summaryPrompt);
    return finalResult.response.text().trim();
  } catch (error) {
    console.error("GEMINI ERROR:", error);
    return "The free AI service is currently busy or the API key is missing. Please try again later.";
  }
}

module.exports = { handleAIQuery };
