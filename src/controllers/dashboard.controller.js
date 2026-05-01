import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.mode.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// 1. Get overarching channel statistics
export const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // A. Get Total Subscribers
    const totalSubscribers = await Subscription.countDocuments({ channel: userId });

    // B. Get Total Videos & Total Views using Aggregation
    const videoStats = await Video.aggregate([
        { 
            $match: { owner: new mongoose.Types.ObjectId(userId) } 
        },
        {
            $group: {
                _id: null,
                totalVideos: { $sum: 1 },
                totalViews: { $sum: "$views" } // Add up all the 'views' fields
            }
        }
    ]);

    // Extract the numbers from the aggregation array (or default to 0 if they have no videos)
    const totalVideos = videoStats[0]?.totalVideos || 0;
    const totalViews = videoStats[0]?.totalViews || 0;

    // C. Get Total Likes across ALL videos
    // First, grab an array of just the Video IDs owned by this user
    const userVideos = await Video.find({ owner: userId }).select("_id");
    const userVideoIds = userVideos.map(video => video._id);

    // Now, count how many likes in the database are attached to those specific Video IDs
    const totalLikes = await Like.countDocuments({ video: { $in: userVideoIds } });

    // Bundle it all up!
    const stats = {
        totalSubscribers,
        totalVideos,
        totalViews,
        totalLikes
    };

    return res.status(200).json(
        new ApiResponse(200, stats, "Channel stats fetched successfully")
    );
});

// 2. Get all videos for the dashboard list (including publish status and like counts)
export const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const videos = await Video.aggregate([
        { 
            $match: { owner: new mongoose.Types.ObjectId(userId) } 
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                likesCount: { $size: "$likes" } // Count the items in the joined likes array
            }
        },
        {
            $project: {
                _id: 1,
                title: 1,
                description: 1,
                videoFile: 1,
                thumbnail: 1,
                views: 1,
                likesCount: 1,
                isPublished: 1, // Crucial for a dashboard so creators can see private vs public videos
                createdAt: 1
            }
        },
        { 
            $sort: { createdAt: -1 } // Show newest videos at the top
        } 
    ]);

    return res.status(200).json(
        new ApiResponse(200, videos, "Channel videos fetched successfully")
    );
});