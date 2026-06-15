import { Membership } from "../models/membership.model.js";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { emitNotification } from "../socket.js";
import { InviteToken } from "../models/invite.model.js";
import { randomBytes } from "node:crypto";

// ========================================================
// EMPLOYEE ACTIONS
// ========================================================

// 🚨 NEW: Fetch the employee's current locked status
export const getMyMembershipStatus = asyncHandler(async (req, res) => {
    // Only fetch if they have an active lock (Pending or Approved)
    // If they were rejected or revoked, this returns null, freeing them to search again!
    const membership = await Membership.findOne({ 
        employee: req.user._id,
        status: { $in: ["PENDING", "APPROVED"] } 
    }).populate("business", "fullName username avatar");

    return res.status(200).json(
        new ApiResponse(200, membership, "Membership status fetched successfully")
    );
});


// 1. Employee requests access to a Business's catalog
export const requestAccess = asyncHandler(async (req, res) => {
    const { businessId } = req.params;

    if (!mongoose.isValidObjectId(businessId)) {
        throw new ApiError(400, "Invalid business ID");
    }

    // 🚨 THE HARD LOCK: Check if they are already active/pending in ANY company
    const activeMembership = await Membership.findOne({
        employee: req.user._id,
        status: { $in: ["PENDING", "APPROVED"] }
    });

    if (activeMembership) {
        // Are they trying to re-apply to the same company they are already pending for?
        if (activeMembership.business.toString() === businessId.toString()) {
            throw new ApiError(400, `You are already ${activeMembership.status.toLowerCase()} for this organization.`);
        } else {
            // They are trying to join a SECOND company while already in one!
            throw new ApiError(403, "Action blocked: You are already associated with an organization. You cannot join multiple companies.");
        }
    }

    // If we reach here, they are completely free. 
    // Let's check if they are re-applying after a prior rejection from THIS specific company.
    let pastMembership = await Membership.findOne({
        business: businessId,
        employee: req.user._id
    });

    if (pastMembership && (pastMembership.status === "REVOKED" || pastMembership.status === "REJECTED")) {
        pastMembership.status = "PENDING";
        await pastMembership.save();
        
        // 🚨 FIRE EVENT: Tell the Business someone re-applied
        emitNotification(businessId, "notification", {
            message: `New access request from ${req.user.fullName || req.user.username}`,
            type: "info"
        });

        return res.status(200).json(
            new ApiResponse(200, pastMembership, "Access request re-submitted successfully.")
        );
    }

    // Fresh application
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

export const generateInviteToken = asyncHandler(async (req, res) => {
    // 1. Ensure only businesses can generate tokens
    if (req.user.role !== "BUSINESS") {
        throw new ApiError(403, "Only Business accounts can generate invite links.");
    }

    // 2. Generate a secure, 16-byte random hex string
    const rawToken = randomBytes(16).toString("hex");
    // 3. Set expiration to 48 hours from exactly right now
    const expirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 4. Save to the database
    const invite = await InviteToken.create({
        token: rawToken,
        business: req.user._id,
        expiresAt: expirationDate
    });

    // 5. Construct the full URL the business can copy/paste to employees
    const inviteLink = `http://localhost:5173/register?invite=${invite.token}`;

    return res.status(201).json(
        new ApiResponse(201, { inviteLink, expiresAt: expirationDate }, "Secure invite link generated")
    );
});