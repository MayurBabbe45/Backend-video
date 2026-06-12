import { VideoProgress } from "../models/videoProgress.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";

export const syncVideoProgress = asyncHandler(async (req, res) => {
    const { videoId, playedRanges } = req.body;
    
    if (!videoId) throw new ApiError(400, "Video ID is required");
    if (!playedRanges || playedRanges.length === 0) {
        return res.status(200).json(new ApiResponse(200, {}, "No progress to sync"));
    }

    // 1. Fetch the user's existing progress from previous sessions
    const existingProgress = await VideoProgress.findOne({ 
        employee: req.user._id, 
        video: videoId 
    });

    // 2. COMBINE existing database ranges with the new incoming ranges
    let combinedRanges = [...playedRanges];
    if (existingProgress && existingProgress.watchedRanges) {
        combinedRanges = [...combinedRanges, ...existingProgress.watchedRanges];
    }

    // 3. Sort the combined intervals by start time
    combinedRanges.sort((a, b) => a.start - b.start);

    // 4. Run the Merge Algorithm on the complete history
    const mergedRanges = [combinedRanges[0]];
    
    for (let i = 1; i < combinedRanges.length; i++) {
        const current = combinedRanges[i];
        const previous = mergedRanges[mergedRanges.length - 1];

        if (current.start <= previous.end) {
            // Overlap found, merge them seamlessly
            previous.end = Math.max(previous.end, current.end);
        } else {
            // No overlap, add as a distinct interval
            mergedRanges.push(current);
        }
    }

    // 5. Sum the exact unique seconds watched across ALL sessions
    const totalSecondsWatched = mergedRanges.reduce((total, range) => {
        return total + (range.end - range.start);
    }, 0);

    // 6. Check against the master video duration
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(404, "Video not found");
    
    // Compliance Rule: Watched 95%? You pass.
    // ALSO: If they were already marked completed in a previous session, NEVER un-complete them!
    const isCompleted = (existingProgress?.isCompleted) || (totalSecondsWatched >= (video.duration * 0.95));

    // 7. Save the fully aggregated data back to the database
    const progress = await VideoProgress.findOneAndUpdate(
        { employee: req.user._id, video: videoId },
        {
            $set: {
                watchedRanges: mergedRanges,
                totalSecondsWatched: parseFloat(totalSecondsWatched.toFixed(2)),
                isCompleted
            }
        },
        { returnDocument: 'after', upsert: true }    );

    return res.status(200).json(
        new ApiResponse(200, progress, "Progress aggregated and synced successfully")
    );
});

export const getVideoComplianceReport = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID");
    }

    // 1. Verify the Business actually owns this video
    const video = await Video.findOne({
        _id: videoId,
        owner: req.user._id
    });

    if (!video) {
        throw new ApiError(404, "Video not found or you do not have permission to view its reports.");
    }

    // 2. Fetch all progress records for this video and attach the employee details
    const complianceReport = await VideoProgress.find({ video: videoId })
        .populate("employee", "fullName username email avatar") // Get the employee's info
        .sort({ updatedAt: -1 }); // Newest activity first

    // 3. Format the data to make it easy for the frontend to render
    const formattedReport = complianceReport.map(record => ({
        id: record._id,
        employeeName: record.employee.fullName || record.employee.username,
        employeeEmail: record.employee.email,
        avatar: record.employee.avatar,
        secondsWatched: record.totalSecondsWatched,
        videoDuration: video.duration,
        progressPercentage: Math.min(((record.totalSecondsWatched / video.duration) * 100), 100).toFixed(1),
        isCompleted: record.isCompleted,
        lastActive: record.updatedAt
    }));

    return res.status(200).json(
        new ApiResponse(200, formattedReport, "Compliance report generated successfully")
    );
});