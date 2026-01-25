const OpenAI = require("openai");
const mongoose = require("mongoose");
// Models import (Same as before)
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

const getSchemas = () => {
  const schemas = {
    DailyPlan: Object.keys(DailyPlan.schema.paths).join(", "),
    Task: Object.keys(Task.schema.paths).join(", "),
    Status: Object.keys(Status.schema.paths).join(", "),
    BPCLStatus: Object.keys(BPCLStatus.schema.paths).join(", "),
    ROMaster: Object.keys(ROMaster.schema.paths).join(", "),
    Incident: Object.keys(Incident.schema.paths).join(", "),
    MaterialRequirement: Object.keys(MaterialRequirement.schema.paths).join(
      ", ",
    ),
    User: Object.keys(User.schema.paths).join(", "),
    atgStatus: Object.keys(atgStatus.schema.paths).join(", "),
    jioBPStatus: Object.keys(jioBPStatus.schema.paths).join(", "),
  };
  return Object.entries(schemas)
    .map(([name, fields]) => `Model: ${name}, Fields: ${fields}`)
    .join("\n");
};

async function handleAIQuery(question) {
  const schemaDescription = getSchemas();

  try {
    // 1. SELECT MODEL
    const modelResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert at selecting the correct Mongoose model. Respond with ONLY the model name from this list: DailyPlan, Task, Status, BPCLStatus, ROMaster, Incident, MaterialRequirement, User, atgStatus, jioBPStatus.",
        },
        { role: "user", content: `Question: "${question}"` },
      ],
      temperature: 0,
    });

    const modelName = modelResponse.choices[0].message.content
      .trim()
      .replace(/[^a-zA-Z]/g, "");
    const Model = mongoose.models[modelName];

    if (!Model) {
      return "I couldn't identify the right data category for your question. Please be more specific (e.g., mention 'incidents', 'tasks', or 'RO').";
    }

    // 2. GENERATE PIPELINE
    const systemPrompt = `
    You are a MongoDB expert. Generate a valid JSON aggregation pipeline array for the model "${modelName}" based on the schema: ${schemaDescription}.
    Today's date is ${new Date().toISOString().split("T")[0]}.
    Respond ONLY with the JSON array. No markdown, no explanation.
    `;

    const queryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: "${question}"` },
      ],
      temperature: 0,
    });

    let pipelineString = queryResponse.choices[0].message.content.trim();
    // CLEANING: Remove markdown backticks if present
    pipelineString = pipelineString
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let pipeline;
    try {
      pipeline = JSON.parse(pipelineString);
    } catch (e) {
      console.error("Pipeline Parse Error:", pipelineString);
      return "I generated an invalid query format. Please try rephrasing your question.";
    }

    // 3. EXECUTE QUERY
    const results = await Model.aggregate(pipeline);

    // 4. FORMAT RESPONSE
    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Summarize the following database results into a natural, user-friendly answer. If no data is found, say we couldn't find any records.",
        },
        {
          role: "user",
          content: `Question: ${question} \nData: ${JSON.stringify(results)}`,
        },
      ],
      temperature: 0.7,
    });

    return finalResponse.choices[0].message.content.trim();
  } catch (error) {
    console.error("AI Service Error:", error);
    return "I'm having trouble connecting to my brain (API). Please check the server logs.";
  }
}

module.exports = { handleAIQuery };
