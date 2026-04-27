import { Router } from 'express';
import { 
    getAllVideos, 
    publishAVideo, 
    getVideoById, 
    updateVideo, 
    deleteVideo 
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// ==========================================
// ROOT ROUTES: /api/v1/videos
// ==========================================

router.route("/")
    .get(getAllVideos) // Public: Get the feed
    .post(             // Secured: Upload a new video
        verifyJWT, 
        upload.fields([
            { name: "videoFile", maxCount: 1 },
            { name: "thumbnail", maxCount: 1 }
        ]),
        publishAVideo
    );


// ==========================================
// DYNAMIC ID ROUTES: /api/v1/videos/:videoId
// ==========================================

router.route("/:videoId")
    .get(getVideoById)               // Public: Watch a video
    .patch(verifyJWT, updateVideo)   // Secured: Update title/description
    .delete(verifyJWT, deleteVideo); // Secured: Delete video and files


export default router;