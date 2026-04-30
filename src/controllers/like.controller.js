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
    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(req.user._id),
                video: { $exists: true, $ne: null } // Only get likes that are attached to a video
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideo"
            }
        },
        {
            $unwind: "$likedVideo"
        },
        {
            $lookup: {
                from: "users",
                localField: "likedVideo.owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },
        {
            $unwind: "$ownerDetails"
        },
        {
            $project: {
                _id: 0,
                "likedVideo._id": 1,
                "likedVideo.videoFile": 1,
                "likedVideo.thumbnail": 1,
                "likedVideo.title": 1,
                "likedVideo.views": 1,
                "ownerDetails.username": 1,
                "ownerDetails.avatar": 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
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