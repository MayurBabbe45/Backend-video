import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    // 1. Validate the video ID
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID");
    }

    // 2. Validate the content
    if (!content || content.trim() === "") {
        throw new ApiError(400, "Comment content is required");
    }

    // 3. Create the comment in the database
    const comment = await Comment.create({
        content: content.trim(),
        video: videoId,
        owner: req.user._id // Provided by verifyJWT
    });

    if (!comment) {
        throw new ApiError(500, "Failed to add comment, please try again");
    }

    return res.status(201).json(
        new ApiResponse(201, comment, "Comment added successfully")
    );
});

export const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query; // Default to page 1, 10 comments per page

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid Video ID format");
    }

    // 1. Calculate how many documents to skip based on the current page
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);

    // 2. Build the assembly line to fetch, join, sort, and paginate
    const comments = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $lookup: {
                from: "users",         // Grab data from the users collection
                localField: "owner",   // Match the comment's owner ID...
                foreignField: "_id",   // ...to the user's _id
                as: "ownerDetails"
            }
        },
        {
            $unwind: "$ownerDetails"
        },
        {
            $sort: {
                createdAt: -1 // Show the newest comments at the top
            }
        },
        {
            $project: {
                content: 1,
                createdAt: 1,
                // Only send safe user data to the frontend
                "ownerDetails.username": 1,
                "ownerDetails.avatar": 1,
                "ownerDetails.fullName": 1
            }
        },
        {
            $skip: skipAmount
        },
        {
            $limit: parseInt(limit)
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, comments, "Comments fetched successfully")
    );
});

export const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID");
    }

    if (!content || content.trim() === "") {
        throw new ApiError(400, "Comment content cannot be empty");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // SECURITY CHECK: Ensure the person editing is the person who wrote it
    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to edit this comment");
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content: content.trim()
            }
        },
        { new: true }
    );

    return res.status(200).json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
    );
});

export const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid Comment ID");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    // SECURITY CHECK: Ensure the person deleting is the person who wrote it
    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this comment");
    }

    await Comment.findByIdAndDelete(commentId);

    // Optional for later: If you build a polymorphic "likes" system, 
    // you would delete all likes associated with this comment here!

    return res.status(200).json(
        new ApiResponse(200, {}, "Comment deleted successfully")
    );
});

