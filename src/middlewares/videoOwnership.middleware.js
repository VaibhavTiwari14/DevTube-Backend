import { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import  asyncHandler  from "../utils/asyncHandler.js";

export const checkVideoOwnership = asyncHandler(async (req, res, next) => {
  const { videoId } = req.params;

  if (!videoId || !isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid video ID provided");
  }

  const video = await Video.findById(videoId).populate("owner");

  if (!video) {
    throw ApiError.notFound("Video not found");
  }

  if (video.owner._id.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("You do not have permission to access this video");
  }

  req.video = video; 
  next();
});
