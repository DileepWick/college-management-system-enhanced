const mongoose = require("mongoose");

const ResetPassword = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "type",
    },
    type: {
      type: String,
      required: true,
      enum: ["AdminDetails", "FacultyDetails", "StudentDetails"],
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index: automatically deletes expired tokens
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ResetPassword", ResetPassword);
