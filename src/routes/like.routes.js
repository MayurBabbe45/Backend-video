import { Router } from 'express';
import {
    getLikedVideos,
    toggleCommentLike,
    toggleVideoLike,
} from "../controllers/like.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Every route in likes requires the user to be logged in
router.use(verifyJWT); 

// ==========================================
// TOGGLE LIKES ROUTES
// ==========================================
router.route("/toggle/v/:videoId").post(toggleVideoLike);
router.route("/toggle/c/:commentId").post(toggleCommentLike);

// ==========================================
// FETCH LIKES ROUTES
// ==========================================
router.route("/videos").get(getLikedVideos);

export default router;