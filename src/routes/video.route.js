import { Router } from 'express';
import { 
    getAllVideos, 
    publishAVideo, 
    getVideoById, 
    updateVideo, 
    deleteVideo 
} from "../controllers/video.controller.js";
import { verifyJWT, restrictTo } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// ==========================================
// ROOT ROUTES: /api/v1/videos
// ==========================================

router.route("/")
    .get(verifyJWT, getAllVideos) // Secured: Returns the gated zero-trust feed
    .post(
        verifyJWT,
        restrictTo("BUSINESS"), // 🚨 The Bouncer: Only businesses can upload corporate media
        upload.fields([
            { name: "videoFile", maxCount: 1 },
            { name: "thumbnail", maxCount: 1 }
        ]),
        publishAVideo 
    );

// ==========================================
// DYNAMIC ID ROUTES: /api/v1/videos/:videoId
// ==========================================

// Apply verifyJWT to ALL dynamic ID routes to prevent anonymous access
router.route("/:videoId")
    .get(
        verifyJWT, 
        getVideoById // Secured: Must verify membership before allowing playback
    ) 
    .patch(
        verifyJWT, 
        restrictTo("BUSINESS"), // 🚨 The Bouncer: Only businesses can edit media
        updateVideo
    ) 
    .delete(
        verifyJWT, 
        restrictTo("BUSINESS"), // 🚨 The Bouncer: Only businesses can delete media
        deleteVideo
    ); 

export default router;