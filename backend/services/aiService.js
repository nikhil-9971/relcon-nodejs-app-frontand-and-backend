const mongoose = require("mongoose");

// Models import (Path sahi check kar lena)
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const ROMaster = require("../models/ROMaster");
const Incident = require("../models/Incident");
const User = require("../models/User");

// Schema helper
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

// 🔹 Direct Fetch function for Gemini (Using Stable v1 Endpoint)
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  // FIXED URL: Using 'v1' and 'gemini-pro' for maximum compatibility
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("Gemini API Error Detail:", data.error);
    throw new Error(data.error.message);
  }

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from AI. Possible safety filter trigger.");
  }

  return data.candidates[0].content.parts[0].text;
}

async function handleAIQuery(question) {
  try {
    const schemaDesc = getSchemas();

    // 1. SELECT MODEL
    const modelPrompt = `Respond with ONLY the Mongoose model name (DailyPlan, Task, ROMaster, Incident, User) for this question: "${question}".`;
    const modelNameRaw = await callGemini(modelPrompt);
    const modelName = modelNameRaw.trim().replace(/[^a-zA-Z]/g, "");

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
    const pipelineRaw = await callGemini(pipelinePrompt);
    let rawJson = pipelineRaw
      .trim()
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let pipeline;
    try {
      pipeline = JSON.parse(rawJson);
    } catch (e) {
      return "I generated an invalid query format. Please try again.";
    }

    // 3. FETCH DATA
    const results = await Model.aggregate(pipeline).limit(5);

    // 4. FINAL SUMMARY
    const summaryPrompt = `
      Question: "${question}"
      Results: ${JSON.stringify(results)}
      Summarize this in a simple, professional, friendly sentence. If no data, say no records found.
    `;
    const finalAnswer = await callGemini(summaryPrompt);
    return finalAnswer.trim();
  } catch (error) {
    console.error("GEMINI FETCH ERROR:", error);
    return "AI error: " + error.message;
  }
}

module.exports = { handleAIQuery };
