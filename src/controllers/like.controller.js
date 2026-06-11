import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.mode.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// 1. Toggle Video Like
export const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Check if the user has already liked this video
    const alreadyLiked = await Like.findOne({
        video: videoId,
        likedBy: req.user._id
    });

    if (alreadyLiked) {
        // If they already liked it, remove the like (Unlike)
        await Like.findByIdAndDelete(alreadyLiked._id);
        return res.status(200).json(new ApiResponse(200, { isLiked: false }, "Removed like from video"));
    }

    // If not liked, create a new like document
    await Like.create({
        video: videoId,
        likedBy: req.user._id
    });

    return res.status(200).json(new ApiResponse(200, { isLiked: true }, "Liked video successfully"));
});

// 2. Toggle Comment Like
export const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    const alreadyLiked = await Like.findOne({
        comment: commentId,
        likedBy: req.user._id
    });

    if (alreadyLiked) {
        await Like.findByIdAndDelete(alreadyLiked._id);
        return res.status(200).json(new ApiResponse(200, { isLiked: false }, "Removed like from comment"));
    }

    await Like.create({
        comment: commentId,
        likedBy: req.user._id
    });

    return res.status(200).json(new ApiResponse(200, { isLiked: true }, "Liked comment successfully"));
});

// 3. Get all videos liked by the current user
export const getLikedVideos = asyncHandler(async (req, res) => {
    const pipeline = [];

    // 1. Find all likes by the current logged-in user
    pipeline.push({
        $match: {
            likedBy: new mongoose.Types.ObjectId(req.user._id),
            video: { $exists: true } // Make sure we only get video likes
        }
    });

    // 2. Lookup the actual video details
    pipeline.push({
        $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "likedVideo"
        }
    });

    pipeline.push({ $unwind: "$likedVideo" });

    // ============================================================================
    // 🚨 THE ZERO-TRUST GATING ENGINE (Intercepting Stale Likes)
    // ============================================================================
    if (req.user.role === "EMPLOYEE") {
        pipeline.push({
            $lookup: {
                from: "memberships",
                let: { videoOwnerId: "$likedVideo.owner" }, // Reference the nested owner ID
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$business", "$$videoOwnerId"] }, 
                                    { $eq: ["$employee", new mongoose.Types.ObjectId(req.user._id)] }, 
                                    { $eq: ["$status", "APPROVED"] } // Must STILL be approved
                                ]
                            }
                        }
                    }
                ],
                as: "accessRights"
            }
        });

        // The Bouncer: If access was revoked, accessRights is empty, so drop the liked video
        pipeline.push({
            $match: {
                accessRights: { $ne: [] } 
            }
        });
    } else if (req.user.role === "BUSINESS") {
        // Businesses should only see likes on their own internal media
        pipeline.push({
            $match: {
                "likedVideo.owner": new mongoose.Types.ObjectId(req.user._id)
            }
        });
    }
    // ============================================================================

    // 3. Lookup the owner details of that specific video
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "likedVideo.owner",
            foreignField: "_id",
            as: "ownerDetails"
        }
    });

    pipeline.push({ $unwind: "$ownerDetails" });

    // 4. Shape the final output to perfectly match the frontend VideoCard
    pipeline.push({
        $project: {
            _id: "$likedVideo._id",
            title: "$likedVideo.title",
            thumbnail: "$likedVideo.thumbnail",
            views: "$likedVideo.views",
            duration: "$likedVideo.duration",
            createdAt: "$likedVideo.createdAt",
            owner: {
                _id: "$ownerDetails._id",
                username: "$ownerDetails.username",
                fullName: "$ownerDetails.fullName",
                avatar: "$ownerDetails.avatar"
            }
        }
    });

    const likedVideos = await Like.aggregate(pipeline);

    return res.status(200).json(
        new ApiResponse(200, likedVideos, "Secure liked videos fetched successfully")
    );
});

// 4. Toggle Tweet Like
export const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    const alreadyLiked = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user._id
    });

    if (alreadyLiked) {
        await Like.findByIdAndDelete(alreadyLiked._id);
        return res.status(200).json(new ApiResponse(200, { isLiked: false }, "Removed like from tweet"));
    }

    await Like.create({
        tweet: tweetId,
        likedBy: req.user._id
    });

    return res.status(200).json(new ApiResponse(200, { isLiked: true }, "Liked tweet successfully"));
});