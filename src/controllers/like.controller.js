import { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";
import { Video } from "../models/video.models.js";
import { Comment } from "../models/comment.models.js";
import { Tweet } from "../models/tweet.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const verifyResourceExists = async (resourceType, resourceId) => {
  let resource;
  let model;

  switch (resourceType) {
    case "video":
      model = Video;
      break;
    case "comment":
      model = Comment;
      break;
    case "tweet":
      model = Tweet;
      break;
    default:
      throw ApiError.badRequest("Invalid resource type");
  }

  resource = await model.findById(resourceId).lean();
  if (!resource) {
    throw ApiError.notFound(
      `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found`
    );
  }

  if (resourceType === "video" && !resource.isPublished) {
    throw ApiError.badRequest("Cannot like unpublished video");
  }

  return resource;
};

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid video ID");
  }

  const userId = req.user._id;

  await verifyResourceExists("video", videoId);

  const existingLike = await Like.findOne({
    likedBy: userId,
    video: videoId,
  }).lean();

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        {
          isLiked: false,
          videoId: videoId,
        },
        "Video unliked successfully"
      )
    );
  } else {
    const newLike = await Like.create({
      likedBy: userId,
      video: videoId,
    });

    return ApiResponse.sendResponse(
      res,
      ApiResponse.created(
        {
          isLiked: true,
          videoId: videoId,
          like: newLike.toObject(),
        },
        "Video liked successfully"
      )
    );
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw ApiError.badRequest("Invalid comment ID");
  }

  const userId = req.user._id;

  await verifyResourceExists("comment", commentId);

  const existingLike = await Like.findOne({
    likedBy: userId,
    comment: commentId,
  }).lean();

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        {
          isLiked: false,
          commentId: commentId,
        },
        "Comment unliked successfully"
      )
    );
  } else {
    const newLike = await Like.create({
      likedBy: userId,
      comment: commentId,
    });

    return ApiResponse.sendResponse(
      res,
      ApiResponse.created(
        {
          isLiked: true,
          commentId: commentId,
          like: newLike.toObject(),
        },
        "Comment liked successfully"
      )
    );
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw ApiError.badRequest("Invalid tweet ID");
  }

  const userId = req.user._id;

  await verifyResourceExists("tweet", tweetId);

  const existingLike = await Like.findOne({
    likedBy: userId,
    tweet: tweetId,
  }).lean();

  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        {
          isLiked: false,
          tweetId: tweetId,
        },
        "Tweet unliked successfully"
      )
    );
  } else {
    const newLike = await Like.create({
      likedBy: userId,
      tweet: tweetId,
    });

    return ApiResponse.sendResponse(
      res,
      ApiResponse.created(
        {
          isLiked: true,
          tweetId: tweetId,
          like: newLike.toObject(),
        },
        "Tweet liked successfully"
      )
    );
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page, limit } = paginationSchema.parse(req.query);

  if (!isValidObjectId(userId)) {
    throw ApiError.badRequest("Invalid user ID");
  }

  const user = await User.findById(userId).select("_id username").lean();

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const skip = (page - 1) * limit;

  const [likedVideos, totalLikes] = await Promise.all([
    Like.find({
      likedBy: userId,
      video: { $exists: true },
    })
      .populate({
        path: "video",
        select:
          "title description thumbnail duration views createdAt owner isPublished",
        match: { isPublished: true },
        populate: {
          path: "owner",
          select: "username avatar",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Like.countDocuments({
      likedBy: userId,
      video: { $exists: true },
    }),
  ]);

  const validLikedVideos = likedVideos.filter((like) => like.video !== null);

  const totalPages = Math.ceil(totalLikes / limit);

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      {
        likedVideos: validLikedVideos,
        pagination: {
          currentPage: page,
          totalPages,
          totalLikes,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      validLikedVideos.length === 0
        ? "No liked videos found"
        : "Liked videos retrieved successfully"
    )
  );
});

const getLikeStatus = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.params;
  const userId = req.user._id;

  if (!["video", "comment", "tweet"].includes(resourceType)) {
    throw ApiError.badRequest(
      "Invalid resource type. Must be video, comment, or tweet"
    );
  }

  if (!isValidObjectId(resourceId)) {
    throw ApiError.badRequest(`Invalid ${resourceType} ID`);
  }

  await verifyResourceExists(resourceType, resourceId);

  const query = { likedBy: userId };
  query[resourceType] = resourceId;

  const existingLike = await Like.findOne(query).lean();

  const [totalLikes] = await Promise.all([
    Like.countDocuments({ [resourceType]: resourceId }),
  ]);

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      {
        isLiked: !!existingLike,
        totalLikes,
        resourceId,
        resourceType,
      },
      "Like status retrieved successfully"
    )
  );
});

const getUserLikeStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [videoLikes, commentLikes, tweetLikes] = await Promise.all([
    Like.countDocuments({ likedBy: userId, video: { $exists: true } }),
    Like.countDocuments({ likedBy: userId, comment: { $exists: true } }),
    Like.countDocuments({ likedBy: userId, tweet: { $exists: true } }),
  ]);

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      {
        stats: {
          totalLikes: videoLikes + commentLikes + tweetLikes,
          videoLikes,
          commentLikes,
          tweetLikes,
        },
      },
      "User like statistics retrieved successfully"
    )
  );
});

export {
  getLikedVideos,
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
  getLikeStatus,
  getUserLikeStats,
};
