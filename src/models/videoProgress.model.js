import mongoose, { Schema } from "mongoose";

const videoProgressSchema = new Schema(
    {
        employee: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            required: true
        },
        // We store the raw ranges just in case HR needs proof of exactly WHAT parts were skipped
        watchedRanges: [
            {
                start: { type: Number },
                end: { type: Number }
            }
        ],
        totalSecondsWatched: {
            type: Number,
            default: 0
        },
        isCompleted: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

// Add a compound index: An employee can only have one progress record per video
videoProgressSchema.index({ employee: 1, video: 1 }, { unique: true });

export const VideoProgress = mongoose.model("VideoProgress", videoProgressSchema);