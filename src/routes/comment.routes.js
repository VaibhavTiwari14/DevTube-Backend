import { Router } from "express";
import {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
  getCommentById,
  getCommentsByUser,
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const commentRouter = Router();

commentRouter.use(verifyJWT);

commentRouter.route("/:videoId").get(getVideoComments);
commentRouter.route("/:videoId").post(addComment);
commentRouter.route("/c/:commentId").patch(updateComment);
commentRouter.route("/c/:commentId").delete(deleteComment);
commentRouter.route("/comment/:commentId").get(getCommentById);
commentRouter.route("/user/:userId").get(getCommentsByUser);

export default commentRouter;
