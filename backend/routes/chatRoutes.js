// routes/chat.routes.js
const express = require("express");
const router = express.Router();
const Chat = require("../models/chat.model");

// 📨 Send a message
router.post("/send", async (req, res) => {
  try {
    const { from, to, text } = req.body;
    const message = await Chat.create({ from, to, text });
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: "Message sending failed." });
  }
});

// 📩 Get messages between two users
router.get("/history/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const messages = await Chat.find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 },
      ],
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Fetching chat history failed." });
  }
});

// ✅ Mark messages as read
router.post("/mark-read", async (req, res) => {
  const { from, to } = req.body;
  try {
    await Chat.updateMany({ from, to, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to mark as read." });
  }
});

module.exports = router;
