const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    roomId: { type: String, required: true }, // private room identifier (e.g., sorted combination of users)
    text: { type: String, required: true },
    delivered: { type: Boolean, default: false }, // delivery receipt
    read: { type: Boolean, default: false }, // read
    // receipt
    replyTo: {
      from: String,
      text: String,
    },
    system: { type: Boolean, default: false },
  },

  { timestamps: true }
);

module.exports = mongoose.model("Chat", ChatSchema);
