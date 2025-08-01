const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");

// Send a message (fallback if not using WS)
router.post("/send", async (req, res) => {
  try {
    const { from, to, text } = req.body;
    const roomId = [from, to].sort().join("__");
    const message = await Chat.create({
      from,
      to,
      text,
      roomId,
      delivered: true,
    }); // via REST consider delivered
    res.status(201).json(message);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Message sending failed.", details: err.message });
  }
});

// Get history for a room (between two users)
router.get("/history/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  const roomId = [user1, user2].sort().join("__");
  try {
    const messages = await Chat.find({ roomId }).sort({ createdAt: 1 }).lean();
    res.json(messages);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Fetching chat history failed.", details: err.message });
  }
});

// Mark all from->to as read
router.post("/mark-read", async (req, res) => {
  const { from, to } = req.body; // mark messages in room where to is current user
  const roomId = [from, to].sort().join("__");
  try {
    await Chat.updateMany({ roomId, to, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to mark as read.", details: err.message });
  }
});

// 📜 Get group chat history
router.get("/history/group", async (req, res) => {
  try {
    const messages = await Chat.find({ roomId: "group" }).sort({
      createdAt: 1,
    });
    res.json(messages);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to load chat", details: err.message });
  }
});

module.exports = router;
