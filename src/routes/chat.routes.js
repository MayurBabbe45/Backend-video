import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getColleagues, sendMessage, getChatHistory, getUnreadCounts, markAsRead } from "../controllers/chat.controller.js";

const router = Router();
router.use(verifyJWT);

router.route("/colleagues").get(getColleagues);
router.route("/send").post(sendMessage);
router.route("/history/:partnerId").get(getChatHistory);
router.route("/unread").get(getUnreadCounts);
router.route("/mark-read/:senderId").post(markAsRead);

export default router;