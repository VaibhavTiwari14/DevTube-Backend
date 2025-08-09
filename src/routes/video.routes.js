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
import errorHandler from "../middlewares/errors.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  validateVideo,
  validateVideoId,
} from "../middlewares/validation.middleware.js";
import { checkVideoOwnership } from "../middlewares/videoOwnership.middleware.js";

const router = Router();

// Public routes
router.get("/published", getAllPublishedVideos);
router.get("/:id", getVideoById);

// Authenticated routes
router.use(verifyJWT);

//for authenticated users only
router.get("/", getAllVideos);

router.post(
  "/",
  upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  validateVideo,
  publishVideo
);

router.patch(
  "/update/:id",
  validateVideoId,
  checkVideoOwnership,
  upload.single("thumbnail"),
  updateVideo
);

router.delete("/delete/:id", validateVideoId, checkVideoOwnership, deleteVideo);

router.patch(
  "/toggle/publish/:id",
  validateVideoId,
  checkVideoOwnership,
  togglePublishStatus
);

router.use(errorHandler);

export default router;
