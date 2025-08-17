const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const User = require("../models/User");

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

// chatRoutes.js
router.get("/history/group", async (req, res) => {
  try {
    // Get normal chat messages (exclude system)
    const userMessages = await Chat.find({
      roomId: "group",
      $or: [{ system: { $exists: false } }, { system: false }],
      text: { $not: { $regex: /^\s*<table[\s\S]*<\/table>\s*$/i } },
    })
      .sort({ createdAt: 1 })
      .lean();

    // Get the latest system message
    let latestSystem = await Chat.findOne({
      roomId: "group",
      system: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (latestSystem) {
      // ⚡ Convert text → html so frontend renders table formatting
      const txt =
        typeof latestSystem.text === "string" ? latestSystem.text : "";
      if (/<table[\s\S]*<\/table>/i.test(txt)) {
        latestSystem.html = txt;
        delete latestSystem.text;
      }
    }

    const messages = latestSystem
      ? [...userMessages, latestSystem]
      : userMessages;

    res.json(messages);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Failed to load chat", details: err.message });
  }
});

router.get("/userlist", async (req, res) => {
  try {
    const users = await User.find({}, "username engineerName").lean();
    const list = users.map((u) => u.engineerName || u.username);
    res.json([...new Set(list)].sort()); // remove duplicates, sort alphabetically
  } catch (err) {
    res.status(500).json({ error: "Failed to get user list" });
  }
});

module.exports = router;
