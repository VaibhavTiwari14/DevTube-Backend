import { Router } from "express";
import {
  getLikedVideos,
  toggleCommentLike,
  toggleVideoLike,
  toggleTweetLike,
  getLikeStatus,
  getUserLikeStats,
} from "../controllers/like.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const likeRouter = Router();
likeRouter.use(verifyJWT);

likeRouter.route("/toggle/v/:videoId").post(toggleVideoLike);
likeRouter.route("/toggle/c/:commentId").post(toggleCommentLike);
likeRouter.route("/toggle/t/:tweetId").post(toggleTweetLike);
likeRouter.route("/videos").get(getLikedVideos);
likeRouter.route("/status/:resourceType/:resourceId").get(getLikeStatus);
likeRouter.route("/stats").get(getUserLikeStats);

export default likeRouter;
