// models/chat.model.js
const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    from: { type: String, required: true }, // sender username
    to: { type: String, required: true }, // receiver username
    text: { type: String, required: true }, // message body
    read: { type: Boolean, default: false }, // read/unread flag
  },
  { timestamps: true } // adds createdAt and updatedAt
);

module.exports = mongoose.model("Chat", ChatSchema);
