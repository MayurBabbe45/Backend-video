import mongoose, { Schema } from "mongoose";

const membershipSchema = new Schema(
    {
        employee: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        business: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED", "REVOKED"],
            default: "PENDING",
            required: true
        }
    },
    { timestamps: true }
);

// Prevent an employee from creating multiple requests to the same business
membershipSchema.index({ employee: 1, business: 1 }, { unique: true });

export const Membership = mongoose.model("Membership", membershipSchema);
