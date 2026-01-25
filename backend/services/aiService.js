const Groq = require("groq-sdk");
const mongoose = require("mongoose");

// Models import
const DailyPlan = require("../models/DailyPlan");
const Task = require("../models/Task");
const ROMaster = require("../models/ROMaster");
const Incident = require("../models/Incident");
const User = require("../models/User");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

    // 1. SELECT MODEL & GENERATE PIPELINE (Combined for Speed)
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a MongoDB expert for RELCON SYSTEMS. 
          Today's date: ${new Date().toISOString().split("T")[0]}.
          Available Models: DailyPlan, Task, ROMaster, Incident, User.
          Schemas: ${schemaDesc}
          
          Task: 
          1. Identify the single best Mongoose model name.
          2. Generate a valid MongoDB aggregation pipeline array.
          
          Respond ONLY in this JSON format:
          {"model": "ModelName", "pipeline": [...]}
          No markdown, no talk.`,
        },
        { role: "user", content: question },
      ],
      model: "llama-3.3-70b-versatile", // Very powerful free model
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);
    const modelName = aiResponse.model;
    const pipeline = aiResponse.pipeline;

    const Model = mongoose.models[modelName];
    if (!Model)
      return "I couldn't find the correct data category. Please try again.";

    // 2. FETCH DATA
    const results = await Model.aggregate(pipeline).limit(5);

    // 3. FINAL SUMMARY
    const summary = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Summarize the database results clearly for the user. If no data, say 'No records found'.",
        },
        {
          role: "user",
          content: `Question: ${question} \nData: ${JSON.stringify(results)}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
    });

    return summary.choices[0].message.content.trim();
  } catch (error) {
    console.error("GROQ ERROR:", error);
    return "AI error: " + error.message;
  }
}

module.exports = { handleAIQuery };
