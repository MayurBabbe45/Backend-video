import { Router } from 'express';
import { 
    toggleSubscription, 
    getUserChannelSubscribers, 
    getSubscribedChannels 
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Every route in subscriptions requires the user to be logged in
router.use(verifyJWT); 

// ==========================================
// CHANNEL ROUTES: /api/v1/subscriptions/c/:channelId
// ==========================================
router.route("/c/:channelId")
    .post(toggleSubscription)          // Toggle subscribe/unsubscribe
    .get(getUserChannelSubscribers);   // Get list of everyone who follows this channel

// ==========================================
// USER ROUTES: /api/v1/subscriptions/u/:subscriberId
// ==========================================
router.route("/u/:subscriberId")
    .get(getSubscribedChannels);       // Get list of channels this user follows

export default router;