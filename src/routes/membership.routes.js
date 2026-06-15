import { Router } from "express";
import { verifyJWT, restrictTo } from "../middlewares/auth.Middleware.js";
import { 
    requestAccess, 
    getPendingRequests, 
    updateRequestStatus, 
    getMyRequests,
    getApprovedEmployees,
    generateInviteToken,
    getMyMembershipStatus
} from "../controllers/membership.controller.js";

const router = Router();

// Every route in here requires the user to be logged in
router.use(verifyJWT);

// ----------------------------------------------------
// EMPLOYEE ROUTES
// ----------------------------------------------------
// Only employees can request access to a business
router.route("/request/:businessId").post(
    restrictTo("EMPLOYEE"), 
    requestAccess
);

// ----------------------------------------------------
// BUSINESS ROUTES
// ----------------------------------------------------
// Only businesses can view and manage requests
router.route("/pending").get(
    restrictTo("BUSINESS"), 
    getPendingRequests
);

router.route("/status/:membershipId").patch(
    restrictTo("BUSINESS"), 
    updateRequestStatus
);

router.route("/my-requests").get(
    restrictTo("EMPLOYEE"), 
    getMyRequests
);

router.route("/approved").get(
    restrictTo("BUSINESS"), 
    getApprovedEmployees
);

router.route("/my-status").get(verifyJWT, getMyMembershipStatus);

router.route("/generate-invite").post(verifyJWT, generateInviteToken);

export default router;