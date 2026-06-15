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
    { timestamps: true } // 🚨 This automatically creates the 'createdAt' field
);

// Optimize queries for loading chat history quickly
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ businessContext: 1 });

// ============================================================================
// 🚨 THE TTL INDEX: Auto-delete messages exactly 10 days after creation
// 10 days = 864,000 seconds
// ============================================================================
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 864000 });

export const Message = mongoose.model("Message", messageSchema);