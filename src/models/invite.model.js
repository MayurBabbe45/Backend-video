import mongoose, { Schema } from "mongoose";

const inviteTokenSchema = new Schema(
    {
        token: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        business: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        expiresAt: {
            type: Date,
            required: true,
            // 🚨 MongoDB automatically deletes this document when the current time passes 'expiresAt'
            index: { expires: 0 } 
        }
    },
    { timestamps: true }
);

export const InviteToken = mongoose.model("InviteToken", inviteTokenSchema);