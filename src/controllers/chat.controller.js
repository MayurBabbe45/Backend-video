import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { Membership } from "../models/membership.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Helper function to figure out what Business "Silo" the user belongs to
const getUserBusinessContext = async (userId, role) => {
    if (role === "BUSINESS") return userId; // The business IS the context

    const membership = await Membership.findOne({ 
        employee: userId, 
        status: "APPROVED" 
    });
    
    if (!membership) throw new ApiError(403, "You are not approved in any organization.");
    return membership.business;
};

export const getColleagues = asyncHandler(async (req, res) => {
    const businessId = await getUserBusinessContext(req.user._id, req.user.role);

    // Get all approved employees in this business
    const memberships = await Membership.find({ 
        business: businessId, 
        status: "APPROVED" 
    }).populate("employee", "fullName username avatar");

    let colleagues = memberships.map(m => m.employee);

    // If the current user is an employee, add the Business owner to their chat list too!
    if (req.user.role === "EMPLOYEE") {
        const businessOwner = await mongoose.model("User").findById(businessId).select("fullName username avatar");
        colleagues.push(businessOwner);
    }

    // Filter out the current user so they don't chat with themselves
    colleagues = colleagues.filter(c => c._id.toString() !== req.user._id.toString());

    return res.status(200).json(
        new ApiResponse(200, colleagues, "Secure corporate directory fetched")
    );
});

export const sendMessage = asyncHandler(async (req, res) => {
    const { receiverId, content } = req.body;
    
    if (!content?.trim() || !receiverId) {
        throw new ApiError(400, "Content and Receiver ID are required");
    }

    const senderBusinessId = await getUserBusinessContext(req.user._id, req.user.role);
    
    // We wrap this in a try-catch because if the receiver is a BUSINESS, getUserBusinessContext will throw an error
    let receiverBusinessId;
    try {
        receiverBusinessId = await getUserBusinessContext(receiverId, "EMPLOYEE");
    } catch (error) {
        receiverBusinessId = receiverId; // If it throws, it means the receiver IS the business owner
    }

    // 🚨 THE ZERO-TRUST CHECK: Do they belong to the same exact company?
    let isAuthorized = false;
    if (req.user.role === "BUSINESS") {
        // Business talking to Employee
        const check = await Membership.findOne({ business: req.user._id, employee: receiverId, status: "APPROVED" });
        if (check) isAuthorized = true;
    } else {
        // Employee talking to someone
        if (receiverId === senderBusinessId.toString()) {
            isAuthorized = true; // Employee talking to their Business Owner
        } else {
            // Employee talking to Employee
            const check = await Membership.findOne({ business: senderBusinessId, employee: receiverId, status: "APPROVED" });
            if (check) isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new ApiError(403, "Security Alert: Cross-company communication is strictly forbidden.");
    }

    // 1. Save the message securely within the silo
    const message = await Message.create({
        sender: req.user._id,
        receiver: receiverId,
        businessContext: senderBusinessId,
        content
    });

    // 2. Populate the sender details so the receiver's frontend can immediately show the avatar/name
    const populatedMessage = await Message.findById(message._id)
        .populate("sender", "fullName username avatar");

    // 3. 🚨 REAL-TIME INJECTION: Fire the message to the receiver's active tabs
    const io = req.app.get("io");
    if (io) {
        io.to(receiverId.toString()).emit("receiveMessage", populatedMessage);
    }

    return res.status(201).json(
        new ApiResponse(201, populatedMessage, "Message delivered securely in real-time")
    );
});

export const getChatHistory = asyncHandler(async (req, res) => {
    const { partnerId } = req.params;
    const businessId = await getUserBusinessContext(req.user._id, req.user.role);

    const messages = await Message.find({
        businessContext: businessId, // Must be inside this company
        $or: [
            { sender: req.user._id, receiver: partnerId },
            { sender: partnerId, receiver: req.user._id }
        ]
    }).sort({ createdAt: 1 }); // Oldest to newest

    return res.status(200).json(
        new ApiResponse(200, messages, "Encrypted chat history fetched")
    );
});

export const getUnreadCounts = asyncHandler(async (req, res) => {
    // MongoDB Aggregation to group unread messages by the sender
    const unreadMessages = await Message.aggregate([
        { $match: { receiver: req.user._id, isRead: false } },
        { $group: { _id: "$sender", count: { $sum: 1 } } }
    ]);

    let total = 0;
    const breakdown = {};
    
    unreadMessages.forEach(item => {
        breakdown[item._id.toString()] = item.count;
        total += item.count;
    });

    return res.status(200).json(
        new ApiResponse(200, { total, breakdown }, "Unread counts fetched")
    );
});

export const markAsRead = asyncHandler(async (req, res) => {
    const { senderId } = req.params;
    
    // Update all unread messages from this specific user to 'read'
    await Message.updateMany(
        { sender: senderId, receiver: req.user._id, isRead: false },
        { $set: { isRead: true } }
    );

    return res.status(200).json(
        new ApiResponse(200, {}, "Messages marked as read")
    );
});