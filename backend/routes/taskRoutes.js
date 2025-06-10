const express = require("express");
const router = express.Router();
const Task = require("../models/Task"); // MongoDB model
const authMiddleware = require("../middleware/authMiddleware"); // JWT validation

// ✅ GET /getTasks - return all tasks
router.get("/getTasks", authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// ✅ PUT /updateTask/:id - update task status or reply
router.put("/updateTask/:id", authMiddleware, async (req, res) => {
  const updates = req.body;
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    res.json({ message: "Task updated", task });
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

module.exports = router;
