import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
// 🚨 IMPORT CLOUDINARY TO GENERATE THE ENCRYPTED URLS
import { v2 as cloudinary } from "cloudinary";

export const getAllVideos = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        query, 
        sortBy = "createdAt", 
        sortType = "desc", 
        userId 
    } = req.query;

    const pipeline = [];

    // 1. Base Match: Only published videos
    const matchConditions = { isPublished: true };

    if (query) {
        matchConditions.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
        ];
    }

    if (req.user.role === "BUSINESS") {
        matchConditions.owner = new mongoose.Types.ObjectId(req.user._id);
    } else if (userId) {
        matchConditions.owner = new mongoose.Types.ObjectId(userId);
    }

    pipeline.push({ $match: matchConditions });

    // ============================================================================
    // 🚨 THE DATA GATING ENGINE (Zero-Trust Intersect for Employees)
    // ============================================================================
    if (req.user.role === "EMPLOYEE") {
        pipeline.push({
            $lookup: {
                from: "memberships", 
                let: { videoOwnerId: "$owner" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$business", "$$videoOwnerId"] }, 
                                    { $eq: ["$employee", new mongoose.Types.ObjectId(req.user._id)] }, 
                                    { $eq: ["$status", "APPROVED"] } 
                                ]
                            }
                        }
                    }
                ],
                as: "accessRights"
            }
        });

        pipeline.push({
            $match: {
                accessRights: { $ne: [] } 
            }
        });
    }
    // ============================================================================

    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner"
        }
    });

    pipeline.push({ $unwind: "$owner" });

    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "video",
            as: "likes"
        }
    });

    pipeline.push({
        $addFields: {
            likesCount: { $size: "$likes" }
        }
    });

    pipeline.push({
        $sort: { [sortBy]: sortType === "asc" ? 1 : -1 }
    });

    pipeline.push({
        $project: {
            _id: 1,
            videoFile: 1,
            cloudinaryPublicId: 1, // 🚨 Ensure we fetch the public ID
            thumbnail: 1,
            title: 1,
            description: 1,
            duration: 1,
            views: 1,
            createdAt: 1,
            likesCount: 1,
            "owner._id": 1,
            "owner.username": 1,
            "owner.avatar": 1,
            "owner.fullName": 1
        }
    });

    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skipAmount });
    pipeline.push({ $limit: parseInt(limit) });

    const videos = await Video.aggregate(pipeline);

    // 🚨 SIGN THE URLS FOR THE ENTIRE FEED
    const securedVideos = videos.map(vid => {
        if (vid.cloudinaryPublicId) {
            vid.videoFile = cloudinary.url(vid.cloudinaryPublicId, {
                resource_type: "video",
                type: "authenticated",
                sign_url: true,
                expires_at: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // 2 hours
            });
        }
        return vid;
    });

    return res.status(200).json(
        new ApiResponse(200, securedVideos, "Secure corporate feed fetched successfully")
    );
});

export const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "Title and description are required");
    }

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new ApiError(500, "Failed to upload video to Cloudinary");
    }
    if (!thumbnail) {
        throw new ApiError(500, "Failed to upload thumbnail to Cloudinary");
    }

    const video = await Video.create({
        title,
        description,
        videoFile: videoFile.url,
        cloudinaryPublicId: videoFile.public_id, // 🚨 SAVED THE ID TO THE DB
        thumbnail: thumbnail.url,
        duration: videoFile.duration, 
        owner: req.user._id, 
        isPublished: true
    });

    return res.status(201).json(
        new ApiResponse(201, video, "Video published successfully into the secure vault")
    );
});

export const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID format");
    }

    const pipeline = [];

    pipeline.push({
        $match: {
            _id: new mongoose.Types.ObjectId(videoId),
            isPublished: true
        }
    });

    // ============================================================================
    // 🚨 THE ZERO-TRUST GATING ENGINE (Single Video Verification)
    // ============================================================================
    if (req.user.role === "EMPLOYEE") {
        pipeline.push({
            $lookup: {
                from: "memberships",
                let: { videoOwnerId: "$owner" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$business", "$$videoOwnerId"] }, 
                                    { $eq: ["$employee", new mongoose.Types.ObjectId(req.user._id)] }, 
                                    { $eq: ["$status", "APPROVED"] } 
                                ]
                            }
                        }
                    }
                ],
                as: "accessRights"
            }
        });

        pipeline.push({
            $match: {
                accessRights: { $ne: [] } 
            }
        });
    } else if (req.user.role === "BUSINESS") {
        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(req.user._id)
            }
        });
    }
    // ============================================================================

    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner"
        }
    });
    pipeline.push({ $unwind: "$owner" });

    pipeline.push({
        $lookup: {
            from: "likes",
            localField: "_id",
            foreignField: "video",
            as: "likes"
        }
    });
    
    pipeline.push({
        $addFields: {
            likesCount: { $size: "$likes" },
            isLiked: {
                $in: [new mongoose.Types.ObjectId(req.user._id), "$likes.likedBy"]
            }
        }
    });

    pipeline.push({
        $project: {
            _id: 1,
            videoFile: 1,
            cloudinaryPublicId: 1, // 🚨 Pass this through the projection
            thumbnail: 1,
            title: 1,
            description: 1,
            duration: 1,
            views: 1,
            createdAt: 1,
            likesCount: 1,
            isLiked: 1,
            "owner._id": 1,
            "owner.username": 1,
            "owner.avatar": 1,
            "owner.fullName": 1
        }
    });

    const video = await Video.aggregate(pipeline);

    if (!video?.length) {
        throw new ApiError(404, "Video not found, or you do not have corporate clearance to view it.");
    }

    // 🚨 GENERATE THE SELF-DESTRUCTING URL
    const publicId = video[0].cloudinaryPublicId; 

    if (publicId) {
        const secureSignedUrl = cloudinary.url(publicId, {
            resource_type: "video",
            type: "authenticated",
            sign_url: true, 
            expires_at: Math.floor(Date.now() / 1000) + (2 * 60 * 60) // Expires in exactly 2 hours
        });

        // Replace the raw database URL with the fresh 2-hour encrypted URL
        video[0].videoFile = secureSignedUrl;
    }

    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

    return res.status(200).json(
        new ApiResponse(200, video[0], "Secure video playback authorized.")
    );
});

export const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID format");
    }

    if (!title || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to edit this video");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description
            }
        },
        { new: true } 
    );

    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video details updated successfully")
    );
});

export const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID format");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this video");
    }

    // Since the thumbnail is stored as a raw URL, extracting the ID via split() still works if the utility falls back
    // However, the video file is securely vaulted, so we MUST pass the exact cloudinaryPublicId
    
    if (video.thumbnail) {
        await deleteFromCloudinary(video.thumbnail); 
    }
    
    if (video.cloudinaryPublicId) {
        // 🚨 Use the exact public ID stored in the DB for the deletion
        await deleteFromCloudinary(video.cloudinaryPublicId, "video"); 
    }

    await Video.findByIdAndDelete(videoId);

    return res.status(200).json(
        new ApiResponse(200, {}, "Video and associated files securely destroyed")
    );
});