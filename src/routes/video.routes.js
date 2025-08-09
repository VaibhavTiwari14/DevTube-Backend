import { Router } from "express";
import {
  deleteVideo,
  getVideoById,
  getAllVideos,
  publishVideo,
  togglePublishStatus,
  updateVideo,
  getAllPublishedVideos,
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  validateVideo,
  validateVideoId,
} from "../middlewares/validation.middleware.js";
import { checkVideoOwnership } from "../middlewares/videoOwnership.middleware.js";

const videoRouter = Router();

// Public routes
videoRouter.get("/published", getAllPublishedVideos);
videoRouter.get("/:id", getVideoById);

// Authenticated routes
videoRouter.use(verifyJWT);

//for authenticated users only
videoRouter.get("/", getAllVideos);

videoRouter.post(
  "/",
  upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  validateVideo,
  publishVideo
);

videoRouter.patch(
  "/update/:id",
  validateVideoId,
  checkVideoOwnership,
  upload.single("thumbnail"),
  updateVideo
);

videoRouter.delete("/delete/:id", validateVideoId, checkVideoOwnership, deleteVideo);

videoRouter.patch(
  "/toggle/publish/:id",
  validateVideoId,
  checkVideoOwnership,
  togglePublishStatus
);

export default videoRouter;
