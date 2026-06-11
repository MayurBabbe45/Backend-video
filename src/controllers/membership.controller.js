import { Membership } from "../models/membership.model.js";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { emitNotification } from "../socket.js";

// ========================================================
// EMPLOYEE ACTIONS
// ========================================================

// 1. Employee requests access to a Business's catalog
export const requestAccess = asyncHandler(async (req, res) => {
    const { businessId } = req.params;

    if (!mongoose.isValidObjectId(businessId)) {
        throw new ApiError(400, "Invalid business ID");
    }

    let existingMembership = await Membership.findOne({
        business: businessId,
        employee: req.user._id
    });

    if (existingMembership) {
        if (existingMembership.status === "PENDING") {
            throw new ApiError(400, "You already have a pending request for this organization.");
        }
        if (existingMembership.status === "APPROVED") {
            throw new ApiError(400, "You are already an approved member of this organization.");
        }
        
        if (existingMembership.status === "REVOKED" || existingMembership.status === "REJECTED") {
            existingMembership.status = "PENDING";
            await existingMembership.save();
            
            // 🚨 FIRE EVENT: Tell the Business someone re-applied
            emitNotification(businessId, "notification", {
                message: `New access request from ${req.user.fullName || req.user.username}`,
                type: "info"
            });

            return res.status(200).json(
                new ApiResponse(200, existingMembership, "Access request re-submitted successfully.")
            );
        }
    }

    const newMembership = await Membership.create({
        business: businessId,
        employee: req.user._id,
        status: "PENDING"
    });

    // 🚨 FIRE EVENT: Tell the Business someone applied for the first time
    emitNotification(businessId, "notification", {
        message: `New access request from ${req.user.fullName || req.user.username}`,
        type: "info"
    });

    return res.status(201).json(
        new ApiResponse(201, newMembership, "Access request sent successfully.")
    );
});

export const getMyRequests = asyncHandler(async (req, res) => {
    // Find all memberships where this user is the employee
    const requests = await Membership.find({
        employee: req.user._id
    })
    .populate("business", "fullName username avatar") // Pull the business details
    .sort({ createdAt: -1 }); // Newest first

    return res.status(200).json(
        new ApiResponse(200, requests, "Sent requests fetched successfully")
    );
});


// ========================================================
// BUSINESS ACTIONS
// ========================================================

// 2. Business views all pending requests from employees
export const getPendingRequests = asyncHandler(async (req, res) => {
    const requests = await Membership.find({
        business: req.user._id,
        status: "PENDING"
    }).populate("employee", "fullName username email avatar"); // Only pull safe user data

    return res.status(200).json(
        new ApiResponse(200, requests, "Pending requests fetched successfully")
    );
});

// 3. Business Approves, Rejects, or Revokes a request
export const updateRequestStatus = asyncHandler(async (req, res) => {
    const { membershipId } = req.params;
    const { status } = req.body; // Expecting "APPROVED", "REJECTED", or "REVOKED"

    if (!["APPROVED", "REJECTED", "REVOKED"].includes(status)) {
        throw new ApiError(400, "Invalid status. Must be APPROVED, REJECTED, or REVOKED");
    }

    // Find the membership and ensure the logged-in business actually owns this request
    const membership = await Membership.findOne({
        _id: membershipId,
        business: req.user._id
    });

    if (!membership) {
        throw new ApiError(404, "Request not found or you do not have permission to manage it");
    }

    // Update the state machine
    membership.status = status;
    await membership.save();

    // 🚨 FIRE EVENT: Tell the Employee their status changed
    let alertMessage = "";
    if (status === "APPROVED") alertMessage = "Your access request was approved! You can now view corporate media.";
    if (status === "REJECTED") alertMessage = "Your access request was declined.";
    if (status === "REVOKED") alertMessage = "Your access to corporate media has been revoked.";

    emitNotification(membership.employee, "notification", {
        message: alertMessage,
        type: status === "APPROVED" ? "success" : "error"
    });

    return res.status(200).json(
        new ApiResponse(200, membership, `Employee access has been ${status.toLowerCase()}`)
    );
});

export const getApprovedEmployees = asyncHandler(async (req, res) => {
    const employees = await Membership.find({
        business: req.user._id,
        status: "APPROVED"
    }).populate("employee", "fullName username email avatar");

    return res.status(200).json(
        new ApiResponse(200, employees, "Active directory fetched successfully")
    );
});