import mongoose from "mongoose";
import Video from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";

const uploadFunction = async (file) => {
  if (!file) throw ApiError.badRequest("File is required for upload");
  const uploadResponse = await uploadOnCloudinary(file.path);
  if (!uploadResponse)
    throw ApiError.internal("Failed to upload file to Cloudinary");
  return {
    publicId: uploadResponse.public_id,
    url: uploadResponse.secure_url,
    format: uploadResponse.format,
    width: uploadResponse.width,
    height: uploadResponse.height,
  };
};

export const publishVideo = asyncHandler(async (req, res) => {
  const { title, description, tags, duration } = req.body;
  const userId = req.user?._id;

  if (!title || !description || !duration) {
    throw ApiError.badRequest("Title, description, and duration are required");
  }

  if (!req.files?.videoFile || !req.files?.thumbnail) {
    throw ApiError.badRequest("Video file and thumbnail are required");
  }

  const [videoUpload, thumbnailUpload] = await Promise.all([
    uploadFunction(req.files.videoFile[0]),
    uploadFunction(req.files.thumbnail[0]),
  ]);

  const createdVideo = await Video.create({
    title,
    description,
    duration,
    tags,
    owner: userId,
    videoFile: {
      url: videoUpload.url,
      public_id: videoUpload.publicId,
    },
    thumbnail: {
      url: thumbnailUpload.url,
      public_id: thumbnailUpload.publicId,
    },
  });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.created(
      {
        video: createdVideo.toObject(),
        videoUpload,
        thumbnailUpload,
      },
      "Video published successfully"
    )
  );
});

export const getAllPublishedVideos = asyncHandler(async (req, res) => {
  const videos = await Video.find({ isPublished: true })
    .populate("owner", "_id name")
    .sort({ createdAt: -1 });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(videos, "Videos fetched successfully")
  );
});

export const getVideoById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest("Invalid video ID provided");
  }

  const video = await Video.findById(id).populate("owner", "_id name");

  if (!video) {
    throw new ApiError(404, "Video not found.");
  }

  video.views++;
  await video.save();

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(video.toObject(), "Video fetched successfully")
  );
});

export const likeVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const video = await Video.findById(id);

  if (!video) {
    throw new ApiError(404, "Video not found.");
  }

  const alreadyLiked = video.likes.includes(userId);

  if (alreadyLiked) {
    video.likes.pull(userId);
  } else {
    video.likes.push(userId);
  }

  await video.save();

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { likesCount: video.likes.length },
      alreadyLiked ? "Like removed." : "Video liked."
    )
  );
});

export const incrementViews = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest("Invalid video ID provided");
  }

  const video = await Video.findByIdAndUpdate(
    id,
    { $inc: { views: 1 } },
    { new: true }
  );

  if (!video) {
    throw new ApiError(404, "Video not found.");
  }

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok({ views: video.views }, "View count incremented")
  );
});

export const deleteVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest("Invalid video ID");
  }

  const video = await Video.findById(id);

  if (!video) throw ApiError.notFound("Video not found");

  if (video.owner.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Not your video");
  }

  await Promise.all([
    deleteFromCloudinary(video.videoFile.public_id),
    deleteFromCloudinary(video.thumbnail.public_id),
  ]);

  await video.deleteOne();

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(null, "Video deleted successfully")
  );
});

export const updateVideo = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest("Invalid video ID");
  }

  const video = await Video.findById(id);

  if (!video) throw ApiError.notFound("Video not found");

  if (video.owner.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Not your video");
  }

  if (title) video.title = title;
  if (description) video.description = description;

  if (req.files?.thumbnail) {
    await deleteFromCloudinary(video.thumbnail.public_id);
    const newThumb = await uploadFunction(req.files.thumbnail[0]);
    video.thumbnail = {
      url: newThumb.url,
      public_id: newThumb.publicId,
    };
  }

  await video.save();

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(video.toObject(), "Video updated successfully")
  );
});

export const togglePublishStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw ApiError.badRequest("Invalid video ID");
  }

  const video = await Video.findById(id);

  if (!video) throw ApiError.notFound("Video not found");

  if (video.owner.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden("Not your video");
  }

  video.isPublished = !video.isPublished;
  await video.save();

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      video.toObject(),
      `Video is now ${video.isPublished ? "published" : "unpublished"}`
    )
  );
});
