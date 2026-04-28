import { Router } from 'express';
import { 
    addComment, 
    deleteComment, 
    getVideoComments, 
    updateComment 
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// ==========================================
// VIDEO COMMENT ROUTES: /api/v1/comments/:videoId
// ==========================================
router.route("/:videoId")
    .get(getVideoComments)         // Public: Anyone can read comments
    .post(verifyJWT, addComment);  // Secured: Must be logged in to post

// ==========================================
// INDIVIDUAL COMMENT ROUTES: /api/v1/comments/c/:commentId
// ==========================================
router.route("/c/:commentId")
    .patch(verifyJWT, updateComment)  // Secured: Only owner can edit
    .delete(verifyJWT, deleteComment);// Secured: Only owner can delete

export default router;