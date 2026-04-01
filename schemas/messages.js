const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "from is required"]
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "to is required"]
    },
    messageContent: {
      type: {
        type: String,
        enum: ["file", "text"],
        required: [true, "messageContent.type is required"]
      },
      text: {
        type: String,
        required: [true, "messageContent.text is required"]
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("message", messageSchema);
