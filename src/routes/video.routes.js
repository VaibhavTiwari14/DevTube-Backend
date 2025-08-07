import { Router } from "express";
import {
  publishVideo,
  getAllVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { checkVideoOwnership } from "../middlewares/videoOwnership.middleware.js";
import {
  validateVideo,
  validateVideoId
} from "../middlewares/validation.middleware.js";
import errorHandler from "../middlewares/errors.middleware.js";

const router = Router();

// Public Routes
router.route("/").get(getAllVideos);
router.route("/:videoId").get(validateVideoId, getVideoById);

// Authenticated Routes
router.use(verifyJWT);

// Publish video
router.post(
  "/",
  upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  validateVideo,
  publishVideo // Rename from publishAVideo for cleaner naming
);

// Update video
router.patch(
  "/:videoId",
  validateVideoId,
  checkVideoOwnership,
  upload.single("thumbnail"),
  updateVideo
);

// Delete video
router.delete("/:videoId", validateVideoId, checkVideoOwnership, deleteVideo);

// Toggle publish status
router.patch(
  "/toggle/publish/:videoId",
  validateVideoId,
  checkVideoOwnership,
  togglePublishStatus
);

// Global error handler
router.use(errorHandler);

export default router;
