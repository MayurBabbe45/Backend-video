import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
    {
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        receiver: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        // 🚨 THE SILO: The organization this conversation belongs to
        businessContext: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        content: {
            type: String,
            required: true
        },
        isRead: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// Optimize queries for loading chat history quickly
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ businessContext: 1 });

export const Message = mongoose.model("Message", messageSchema);