import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

export const getAllVideos = asyncHandler(async (req, res) => {
    // 1. Extract query parameters with default fallbacks
    const { 
        page = 1, 
        limit = 10, 
        query, 
        sortBy = "createdAt", 
        sortType = "desc", 
        userId 
    } = req.query;

    const pipeline = [];

    // 2. Match Stage: Filter by published status, owner, and search query
    const matchConditions = { isPublished: true }; // Only show published videos in feeds

    // If a userId is provided, filter by that specific channel
    if (userId) {
        // We must convert the string userId to a valid MongoDB ObjectId
        matchConditions.owner = new mongoose.Types.ObjectId(userId);
    }

    // If a search query is provided, search in title or description
    if (query) {
        matchConditions.$or = [
            { title: { $regex: query, $options: "i" } }, // 'i' for case-insensitive
            { description: { $regex: query, $options: "i" } }
        ];
    }

    pipeline.push({ $match: matchConditions });

    // 3. Lookup Stage: Join with the users collection to get channel details
    pipeline.push({
        $lookup: {
            from: "users", // The exact name of your collection in MongoDB
            localField: "owner",
            foreignField: "_id",
            as: "owner"
        }
    });

    // 4. Unwind Stage: Turn the owner array into a single object
    pipeline.push({ $unwind: "$owner" });

    // 5. Sort Stage: Dynamically sort (e.g., by views, or createdAt)
    pipeline.push({
        $sort: {
            [sortBy]: sortType === "asc" ? 1 : -1
        }
    });

    // 6. Project Stage: Clean up the data before sending it to the frontend
    pipeline.push({
        $project: {
            _id: 1,
            videoFile: 1,
            thumbnail: 1,
            title: 1,
            description: 1,
            duration: 1,
            views: 1,
            createdAt: 1,
            // Only send necessary user info, NEVER send passwords or tokens
            "owner._id": 1,
            "owner.username": 1,
            "owner.avatar": 1,
            "owner.fullName": 1
        }
    });

    // 7. Pagination Stage
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skipAmount });
    pipeline.push({ $limit: parseInt(limit) });

    // 8. Execute the pipeline
    const videos = await Video.aggregate(pipeline);

    return res.status(200).json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    );
});

export const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    // 1. Validate the text fields
    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "Title and description are required");
    }

    // 2. Get the local file paths that Multer saved temporarily
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail is required");
    }

    // 3. Upload both files to Cloudinary
    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new ApiError(500, "Failed to upload video to Cloudinary");
    }
    if (!thumbnail) {
        throw new ApiError(500, "Failed to upload thumbnail to Cloudinary");
    }

    // 4. Save the video details to the database
    const video = await Video.create({
        title,
        description,
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        duration: videoFile.duration, // Cloudinary provides this automatically
        owner: req.user._id, // This will come from your verifyJWT middleware later
        isPublished: true
    });

    // 5. Send the success response
    return res.status(201).json(
        new ApiResponse(201, video, "Video published successfully")
    );
});

export const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID format");
    }

    // --- 🚨 OPTIONAL AUTH CHECK 🚨 ---
    // Because watching a video is public, req.user is undefined.
    // We manually decode the token here to see if a user happens to be logged in.
    let userId = null;
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    
    if (token) {
        try {
            const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            userId = new mongoose.Types.ObjectId(decodedToken._id);
        } catch (error) {
            // Token is missing or expired, do nothing (treat as a guest viewer)
        }
    }
    // ----------------------------------

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        // Look up the subscriptions BEFORE we unwind the owner
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"            
            }
        },
        {
            $unwind: "$owner"          
        },
        {
            $addFields: {
                isSubscribed: {
                    $cond: {
                        if: { 
                            // 🚨 We use our manually extracted userId here!
                            $in: [userId, "$subscribers.subscriber"] 
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                createdAt: 1,
                isSubscribed: 1, 
                "owner._id": 1,
                "owner.username": 1,
                "owner.avatar": 1,
                "owner.fullName": 1
            }
        }
    ]);
    
    if (!video?.length) {
        throw new ApiError(404, "Video not found");
    }

    // Increment the view count in the database
    await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: { views: 1 } 
        }
    );

    return res.status(200).json(
        new ApiResponse(200, video[0], "Video fetched successfully")
    );
});

export const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    // 1. Validate the video ID
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID format");
    }

    // 2. Ensure title and description are provided
    if (!title || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    // 3. Find the video in the database
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 4. SECURITY CHECK: Is the logged-in user the owner of this video?
    // We convert both ObjectIds to strings to compare them safely
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to edit this video");
    }

    // 5. Update the video
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description
            }
        },
        { new: true } // This tells Mongoose to return the newly updated document
    );

    return res.status(200).json(
        new ApiResponse(200, updatedVideo, "Video details updated successfully")
    );
});

export const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate the video ID
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID format");
    }

    // 2. Find the video in the database
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 3. SECURITY CHECK: Is the logged-in user the owner of this video?
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this video");
    }

    // 4. Clean up Cloudinary storage 
    // Wait for both deletions to finish before moving on
    if (video.thumbnail) {
        await deleteFromCloudinary(video.thumbnail); // Defaults to "image"
    }
    
    if (video.videoFile) {
        // We MUST pass "video" as the second argument so Cloudinary knows what to look for
        await deleteFromCloudinary(video.videoFile, "video"); 
    }

    // 5. Delete the video document from the MongoDB database
    await Video.findByIdAndDelete(videoId);

    // Optional for the future: You would also write logic here to delete all 
    // likes and comments associated with this video so they don't become "orphaned" data.

    return res.status(200).json(
        new ApiResponse(200, {}, "Video and associated files deleted successfully")
    );
});