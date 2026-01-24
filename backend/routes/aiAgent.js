const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");

router.post("/ask", async (req, res) => {
  try {
    const { prompt, user } = req.body;

    if (!prompt) {
      return res.status(400).json({ reply: "Question missing" });
    }

    // Call the new AI service
    const reply = await aiService.getAIResponse(prompt, user);

    res.json({ answer: reply }); // Frontend expects 'answer'
  } catch (err) {
    console.error("AI service error:", err);
    res.status(500).json({
      answer: "Sorry, I encountered an error while processing your request.",
    });
  }
});

module.exports = router;
