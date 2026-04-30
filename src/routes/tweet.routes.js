import { Router } from 'express';
import {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
} from "../controllers/tweet.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Require user to be logged in for all tweet routes
router.use(verifyJWT);

// Root route
router.route("/")
    .post(createTweet);

// Get tweets by a specific user
router.route("/user/:userId")
    .get(getUserTweets);

// Update or delete a specific tweet
router.route("/:tweetId")
    .patch(updateTweet)
    .delete(deleteTweet);

export default router;