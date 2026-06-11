import { Router } from "express";
import { getVideoComplianceReport, syncVideoProgress } from "../controllers/progress.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// 🚨 Apply the verifyJWT middleware to all routes in this file
// This ensures req.user._id is populated before the controller runs
router.use(verifyJWT);

// Route: POST /api/v1/progress/sync
router.route("/sync").post(syncVideoProgress);
router.route("/report/:videoId").get(getVideoComplianceReport);

export default router;