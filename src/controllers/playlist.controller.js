import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.models.js";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";

const playlistSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Playlist name must be at least 2 characters")
    .max(50, "Playlist name must be at most 50 characters")
    .refine((val) => val.length > 0, "Playlist name cannot be empty"),

  description: z
    .string()
    .trim()
    .min(10, "Playlist description must be at least 10 characters")
    .max(500, "Playlist description must be at most 500 characters")
    .optional(),
});

const updatePlaylistSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Playlist name must be at least 2 characters")
      .max(50, "Playlist name must be at most 50 characters")
      .optional(),

    description: z
      .string()
      .trim()
      .min(10, "Playlist description must be at least 10 characters")
      .max(500, "Playlist description must be at most 500 characters")
      .optional(),
  })
  .refine((data) => data.name || data.description, {
    message: "At least one field (name or description) must be provided",
  });

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const checkPlaylistOwnership = async (playlistId, userId) => {
  const playlist = await Playlist.findById(playlistId).lean();
  if (!playlist) {
    throw ApiError.notFound("Playlist not found");
  }

  if (playlist.owner.toString() !== userId.toString()) {
    throw ApiError.forbidden(
      "Access denied. You can only modify your own playlists"
    );
  }

  return playlist;
};

const verifyVideoExists = async (videoId) => {
  const video = await Video.findById(videoId).select("_id isPublished").lean();
  if (!video) {
    throw ApiError.notFound("Video not found");
  }

  if (!video.isPublished) {
    throw ApiError.badRequest("Cannot add unpublished video to playlist");
  }

  return video;
};

const createPlaylist = asyncHandler(async (req, res) => {
  const validateData = playlistSchema.safeParse(req.body);
  if (!validateData.success) {
    throw ApiError.badRequest(validateData.error.errors[0].message);
  }

  const { name, description } = validateData.data;
  const userId = req.user._id;

  const existingPlaylist = await Playlist.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    owner: userId,
  }).lean();

  if (existingPlaylist) {
    throw ApiError.conflict("You already have a playlist with this name");
  }

  const playlist = await Playlist.create({
    name,
    description: description || "",
    owner: userId,
    videos: [],
    isPublic: false,
  });

  const playlistObject = playlist.toObject();
  delete playlistObject.__v;

  return ApiResponse.sendResponse(
    res,
    ApiResponse.created(
      { playlist: playlistObject },
      "Playlist created successfully"
    )
  );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page, limit } = paginationSchema.parse(req.query);

  if (!isValidObjectId(userId)) {
    throw ApiError.badRequest("Invalid user ID provided");
  }

  const user = await User.findById(userId).select("_id username").lean();
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  let query = { owner: userId };

  if (!req.user || req.user._id.toString() !== userId) {
    query.isPublic = true;
  }

  const skip = (page - 1) * limit;

  const [playlists, totalPlaylists] = await Promise.all([
    Playlist.find(query)
      .select("name description videos createdAt updatedAt isPublic")
      .populate("owner", "username avatar")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Playlist.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalPlaylists / limit);

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      {
        playlists,
        pagination: {
          currentPage: page,
          totalPages,
          totalPlaylists,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      playlists.length === 0
        ? "No playlists found"
        : "Playlists fetched successfully"
    )
  );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { page, limit } = paginationSchema.parse(req.query);

  if (!isValidObjectId(playlistId)) {
    throw ApiError.badRequest("Invalid playlist ID provided");
  }

  const playlist = await Playlist.findById(playlistId)
    .populate("owner", "username avatar")
    .lean();

  if (!playlist) {
    throw ApiError.notFound("Playlist not found");
  }

  if (
    !playlist.isPublic &&
    (!req.user || req.user._id.toString() !== playlist.owner._id.toString())
  ) {
    throw ApiError.forbidden("Access denied. This playlist is private");
  }

  const skip = (page - 1) * limit;
  const totalVideos = playlist.videos.length;
  const paginatedVideoIds = playlist.videos.slice(skip, skip + limit);

  const videos = await Video.find({
    _id: { $in: paginatedVideoIds },
    isPublished: true,
  })
    .select("title description thumbnail duration views createdAt owner")
    .populate("owner", "username avatar")
    .lean();

  const orderedVideos = paginatedVideoIds
    .map((id) => videos.find((video) => video._id.toString() === id.toString()))
    .filter(Boolean);

  const totalPages = Math.ceil(totalVideos / limit);

  const playlistResponse = {
    ...playlist,
    videos: orderedVideos,
    videoCount: totalVideos,
    pagination: {
      currentPage: page,
      totalPages,
      totalVideos,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };

  delete playlistResponse.__v;

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { playlist: playlistResponse },
      "Playlist fetched successfully"
    )
  );
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid playlist or video ID provided");
  }

  const playlist = await checkPlaylistOwnership(playlistId, req.user._id);

  await verifyVideoExists(videoId);

  if (playlist.videos.some((id) => id.toString() === videoId)) {
    throw ApiError.conflict("Video already exists in the playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $push: { videos: videoId },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  )
    .populate("owner", "username avatar")
    .lean();

  delete updatedPlaylist.__v;

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { playlist: updatedPlaylist },
      "Video added to playlist successfully"
    )
  );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid playlist or video ID provided");
  }

  const playlist = await checkPlaylistOwnership(playlistId, req.user._id);

  if (!playlist.videos.some((id) => id.toString() === videoId)) {
    throw ApiError.notFound("Video does not exist in the playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $pull: { videos: videoId },
      $set: { updatedAt: new Date() },
    },
    { new: true }
  )
    .populate("owner", "username avatar")
    .lean();

  delete updatedPlaylist.__v;

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { playlist: updatedPlaylist },
      "Video removed from playlist successfully"
    )
  );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw ApiError.badRequest("Invalid playlist ID provided");
  }

  await checkPlaylistOwnership(playlistId, req.user._id);

  const deletedPlaylist = await Playlist.findByIdAndDelete(playlistId).lean();

  delete deletedPlaylist.__v;

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { playlist: deletedPlaylist },
      "Playlist deleted successfully"
    )
  );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw ApiError.badRequest("Invalid playlist ID provided");
  }

  const validateData = updatePlaylistSchema.safeParse(req.body);
  if (!validateData.success) {
    throw ApiError.badRequest(validateData.error.errors[0].message);
  }

  await checkPlaylistOwnership(playlistId, req.user._id);

  const updateData = validateData.data;

  if (updateData.name) {
    const existingPlaylist = await Playlist.findOne({
      name: { $regex: new RegExp(`^${updateData.name}$`, "i") },
      owner: req.user._id,
      _id: { $ne: playlistId },
    }).lean();

    if (existingPlaylist) {
      throw ApiError.conflict("You already have a playlist with this name");
    }
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      ...updateData,
      updatedAt: new Date(),
    },
    { new: true, runValidators: true }
  )
    .populate("owner", "username avatar")
    .lean();

  delete updatedPlaylist.__v;

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { playlist: updatedPlaylist },
      "Playlist updated successfully"
    )
  );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
