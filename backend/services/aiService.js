const OpenAI = require("openai");
const mongoose = require("mongoose");
// Import all models to access their schemas
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

// Helper function to get schema description
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

  const systemPrompt = `
You are an expert at converting natural language questions into MongoDB aggregation pipelines.
Your goal is to generate a valid MongoDB aggregation pipeline JSON object based on the user's question and the provided database schemas.
You must respond with only the JSON object for the aggregation pipeline. Do not include any other text, explanation, or markdown formatting.
The pipeline should be an array of stages.
Today's date is ${new Date().toISOString().split("T")[0]}.

Here are the available Mongoose models and their schemas:
${schemaDescription}

Determine which model is most relevant to the user's question to construct the query.
If the question is about "visits", "plans", or "schedules", use the "DailyPlan" model.
If the question is about "tasks", use the "Task" model.
If the question is about "incidents" or "complaints", use the "Incident" model.
If the question is about "engineers" or "users", use the "User" model.
If the question is about "RO" or "sites", use the "ROMaster" model.

If the user asks a generic question like "how many" or "total count", you should generate a pipeline with a $count stage.
Example: "how many incidents are pending?" should generate a pipeline for the Incident model: '[{ "$match": { "status": "Pending" } }, { "$count": "total" }]'
If the user asks for a list, generate a pipeline that returns the relevant fields.
Example: "list all engineers" should generate a pipeline for the User model: '[{ "$project": { "engineerName": 1, "_id": 0 } }]'
If a query requires matching text, use the $regex operator with the 'i' option for case-insensitivity.
Example: "find RO with name containing 'patna'" should be '[{ "$match": { "roName": { "$regex": "patna", "$options": "i" } } }]' on ROMaster model.

You must determine the single most appropriate model to query. Do not join collections.
Respond ONLY with the JSON array for the aggregation pipeline.
`;

  try {
    const modelResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ SAFE MODEL
      messages: [
        {
          role: "system",
          content:
            "You are an expert at selecting the correct Mongoose model from a list based on a user's question. Respond with only the model name. Available models are: DailyPlan, Task, Status, BPCLStatus, ROMaster, Incident, MaterialRequirement, User, atgStatus, jioBPStatus.",
        },
        { role: "user", content: `Question: "${question}"` },
      ],
      temperature: 0,
    });
    const modelName = modelResponse.choices[0].message.content.trim();
    const Model = mongoose.models[modelName];

    if (!Model) {
      return "Sorry, I'm not sure which data to query for that question.";
    }

    const queryResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ SAFE MODEL
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: "${question}"` },
      ],
      temperature: 0,
    });

    const pipelineString = queryResponse.choices[0].message.content.trim();

    let pipeline;
    try {
      pipeline = JSON.parse(pipelineString);
    } catch (e) {
      console.error("Failed to parse pipeline JSON:", e);
      return "Sorry, I generated an invalid query. Please try again.";
    }

    const results = await Model.aggregate(pipeline);

    const finalPrompt = `
You are a helpful AI assistant. You have been asked the following question: "${question}".
You have already queried the database and received the following JSON data:
${JSON.stringify(results, null, 2)}

Your task is to formulate a user-friendly, natural language response based on this data.
If the data is a count, the response should be simple and direct. For example, "There are 5 pending incidents."
If the data is a list of items, format it as a clean, readable list.
If there are no results, inform the user that no data was found for their query.
Do not include the raw JSON data in your response.
Keep your response concise and easy to understand.
`;

    const finalResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini", // ✅ SAFE MODEL
      messages: [{ role: "system", content: finalPrompt }],
      temperature: 0.7,
    });

    return finalResponse.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error with OpenAI API or database query:", error);
    return "Sorry, I encountered an error trying to process your request.";
  }
}

module.exports = { handleAIQuery };
