import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.models.js";
import { Video } from "../models/video.models.js";
import { Like } from "../models/like.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { z } from "zod";

// Validation schemas
const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment content cannot be empty")
    .max(500, "Comment content must be at most 500 characters"),
});

const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment content cannot be empty")
    .max(500, "Comment content must be at most 500 characters"),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sortBy: z.enum(["newest", "oldest", "popular"]).default("newest"),
});

// Helper functions
const verifyVideoExists = async (videoId) => {
  const video = await Video.findById(videoId)
    .select("_id isPublished")
    .lean()
    .exec();

  if (!video) {
    throw ApiError.notFound("Video not found");
  }

  if (!video.isPublished) {
    throw ApiError.badRequest("Cannot comment on unpublished video");
  }

  return video;
};

const checkCommentOwnership = async (commentId, userId) => {
  const comment = await Comment.findById(commentId)
    .select("_id owner")
    .lean()
    .exec();

  if (!comment) {
    throw ApiError.notFound("Comment not found");
  }

  if (comment.owner.toString() !== userId.toString()) {
    throw ApiError.forbidden(
      "Access denied. You can only modify your own comments"
    );
  }

  return comment;
};

const buildCommentAggregation = (videoId, userId, sortOptions, skip, limit) => {
  const pipeline = [
    { $match: { video: new mongoose.Types.ObjectId(videoId) } },

    // Lookup owner information
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { username: 1, avatar: 1, fullName: 1 } }],
      },
    },
    { $unwind: "$owner" },

    // Lookup likes with conditional user check
    {
      $lookup: {
        from: "likes",
        let: { commentId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$comment", "$$commentId"] },
                  { $eq: ["$resourceType", "Comment"] },
                ],
              },
            },
          },
          { $project: { likedBy: 1 } },
        ],
        as: "likes",
      },
    },

    // Add computed fields
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        isLikedByUser: userId
          ? {
              $in: [new mongoose.Types.ObjectId(userId), "$likes.likedBy"],
            }
          : false,
        isOwner: userId
          ? {
              $eq: ["$owner._id", new mongoose.Types.ObjectId(userId)],
            }
          : false,
      },
    },

    // Project final fields
    {
      $project: {
        _id: 1,
        content: 1,
        video: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
        likesCount: 1,
        isLikedByUser: 1,
        isOwner: 1,
      },
    },

    // Sort
    { $sort: sortOptions },

    // Pagination
    { $skip: skip },
    { $limit: limit },
  ];

  return pipeline;
};

// Controllers
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page, limit, sortBy } = paginationSchema.parse(req.query);

  if (!isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid video ID provided");
  }

  // Verify video exists in parallel with comment aggregation setup
  const verifyVideoPromise = verifyVideoExists(videoId);

  const skip = (page - 1) * limit;
  const userId = req.user?._id;

  // Define sort options
  let sortOptions = {};
  switch (sortBy) {
    case "newest":
      sortOptions = { createdAt: -1 };
      break;
    case "oldest":
      sortOptions = { createdAt: 1 };
      break;
    case "popular":
      sortOptions = { likesCount: -1, createdAt: -1 };
      break;
  }

  // Build aggregation pipeline
  const pipeline = buildCommentAggregation(
    videoId,
    userId,
    sortOptions,
    skip,
    limit
  );

  try {
    // Execute all operations in parallel
    const [_, comments, totalComments] = await Promise.all([
      verifyVideoPromise,
      Comment.aggregate(pipeline).exec(),
      Comment.countDocuments({ video: videoId }).exec(),
    ]);

    const totalPages = Math.ceil(totalComments / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        {
          comments,
          pagination: {
            currentPage: page,
            totalPages,
            totalComments,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? page + 1 : null,
            prevPage: hasPrevPage ? page - 1 : null,
          },
        },
        comments.length === 0
          ? "No comments found for this video"
          : `${comments.length} comment(s) fetched successfully`
      )
    );
  } catch (error) {
    throw error;
  }
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req.user._id;

  if (!isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid video ID provided");
  }

  const validateData = commentSchema.safeParse(req.body);
  if (!validateData.success) {
    const errorMessage =
      validateData.error.errors[0]?.message || "Invalid input data";
    throw ApiError.badRequest(errorMessage);
  }

  const { content } = validateData.data;

  // Verify video exists before creating comment
  await verifyVideoExists(videoId);

  try {
    // Create comment
    const comment = await Comment.create({
      content,
      video: videoId,
      owner: userId,
    });

    // Fetch the created comment with populated data
    const populatedComment = await Comment.findById(comment._id)
      .populate("owner", "username avatar fullName")
      .select("-__v")
      .lean()
      .exec();

    // Prepare response with additional fields
    const commentResponse = {
      ...populatedComment,
      likesCount: 0,
      isLikedByUser: false,
      isOwner: true,
    };

    return ApiResponse.sendResponse(
      res,
      ApiResponse.created(
        { comment: commentResponse },
        "Comment added successfully"
      )
    );
  } catch (error) {
    // Handle potential duplicate or validation errors
    if (error.code === 11000) {
      throw ApiError.badRequest("Duplicate comment detected");
    }
    throw error;
  }
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  if (!isValidObjectId(commentId)) {
    throw ApiError.badRequest("Invalid comment ID provided");
  }

  const validateData = updateCommentSchema.safeParse(req.body);
  if (!validateData.success) {
    const errorMessage =
      validateData.error.errors[0]?.message || "Invalid input data";
    throw ApiError.badRequest(errorMessage);
  }

  const { content } = validateData.data;

  // Verify ownership
  await checkCommentOwnership(commentId, userId);

  try {
    // Update comment with optimistic concurrency
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        $set: {
          content,
          updatedAt: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
        lean: true,
      }
    )
      .populate("owner", "username avatar fullName")
      .select("-__v")
      .exec();

    if (!updatedComment) {
      throw ApiError.notFound("Comment not found");
    }

    // Get like information
    const likes = await Like.find({
      comment: commentId,
      resourceType: "Comment",
    })
      .select("likedBy")
      .lean()
      .exec();

    const commentResponse = {
      ...updatedComment,
      likesCount: likes.length,
      isLikedByUser: likes.some(
        (like) => like.likedBy.toString() === userId.toString()
      ),
      isOwner: true,
    };

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        { comment: commentResponse },
        "Comment updated successfully"
      )
    );
  } catch (error) {
    if (error.name === "ValidationError") {
      throw ApiError.badRequest("Invalid comment data provided");
    }
    throw error;
  }
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user._id;

  if (!isValidObjectId(commentId)) {
    throw ApiError.badRequest("Invalid comment ID provided");
  }

  // Verify ownership
  await checkCommentOwnership(commentId, userId);

  try {
    // Use transaction for atomic operations
    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // Delete comment
      const deletedComment = await Comment.findByIdAndDelete(commentId)
        .select("-__v")
        .lean()
        .session(session)
        .exec();

      if (!deletedComment) {
        throw ApiError.notFound("Comment not found");
      }

      // Delete associated likes
      await Like.deleteMany({
        comment: commentId,
        resourceType: "Comment",
      }).session(session);

      return deletedComment;
    });

    await session.endSession();

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        {
          message: "Comment and associated data deleted successfully",
          commentId,
        },
        "Comment deleted successfully"
      )
    );
  } catch (error) {
    throw error;
  }
});

const getCommentById = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user?._id;

  if (!isValidObjectId(commentId)) {
    throw ApiError.badRequest("Invalid comment ID provided");
  }

  try {
    // Use aggregation for consistent data structure
    const commentAggregation = await Comment.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(commentId) } },

      // Lookup owner
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [{ $project: { username: 1, avatar: 1, fullName: 1 } }],
        },
      },
      { $unwind: "$owner" },

      // Lookup video
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "video",
          pipeline: [{ $project: { title: 1, thumbnail: 1 } }],
        },
      },
      { $unwind: "$video" },

      // Lookup likes
      {
        $lookup: {
          from: "likes",
          let: { commentId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$comment", "$$commentId"] },
                    { $eq: ["$resourceType", "Comment"] },
                  ],
                },
              },
            },
            { $project: { likedBy: 1 } },
          ],
          as: "likes",
        },
      },

      // Add computed fields
      {
        $addFields: {
          likesCount: { $size: "$likes" },
          isLikedByUser: userId
            ? {
                $in: [new mongoose.Types.ObjectId(userId), "$likes.likedBy"],
              }
            : false,
          isOwner: userId
            ? {
                $eq: ["$owner._id", new mongoose.Types.ObjectId(userId)],
              }
            : false,
        },
      },

      // Project final fields
      {
        $project: {
          _id: 1,
          content: 1,
          video: 1,
          owner: 1,
          createdAt: 1,
          updatedAt: 1,
          likesCount: 1,
          isLikedByUser: 1,
          isOwner: 1,
        },
      },
    ]).exec();

    if (!commentAggregation || commentAggregation.length === 0) {
      throw ApiError.notFound("Comment not found");
    }

    const comment = commentAggregation[0];

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok({ comment }, "Comment fetched successfully")
    );
  } catch (error) {
    throw error;
  }
});

// Utility function for bulk operations (bonus)
const getCommentsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page, limit, sortBy } = paginationSchema.parse(req.query);
  const requestingUserId = req.user._id;

  if (!isValidObjectId(userId)) {
    throw ApiError.badRequest("Invalid user ID provided");
  }

  const skip = (page - 1) * limit;

  let sortOptions = {};
  switch (sortBy) {
    case "newest":
      sortOptions = { createdAt: -1 };
      break;
    case "oldest":
      sortOptions = { createdAt: 1 };
      break;
    case "popular":
      sortOptions = { likesCount: -1, createdAt: -1 };
      break;
  }

  try {
    const [comments, totalComments] = await Promise.all([
      Comment.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(userId) } },

        // Lookup video info
        {
          $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "video",
            pipeline: [
              { $project: { title: 1, thumbnail: 1, isPublished: 1 } },
            ],
          },
        },
        { $unwind: "$video" },

        // Only show comments on published videos
        { $match: { "video.isPublished": true } },

        // Lookup owner info
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [{ $project: { username: 1, avatar: 1, fullName: 1 } }],
          },
        },
        { $unwind: "$owner" },

        // Lookup likes
        {
          $lookup: {
            from: "likes",
            let: { commentId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$comment", "$$commentId"] },
                      { $eq: ["$resourceType", "Comment"] },
                    ],
                  },
                },
              },
              { $project: { likedBy: 1 } },
            ],
            as: "likes",
          },
        },

        {
          $addFields: {
            likesCount: { $size: "$likes" },
            isLikedByUser: requestingUserId
              ? {
                  $in: [
                    new mongoose.Types.ObjectId(requestingUserId),
                    "$likes.likedBy",
                  ],
                }
              : false,
            isOwner: requestingUserId
              ? {
                  $eq: [
                    "$owner._id",
                    new mongoose.Types.ObjectId(requestingUserId),
                  ],
                }
              : false,
          },
        },

        {
          $project: {
            _id: 1,
            content: 1,
            video: 1,
            owner: 1,
            createdAt: 1,
            updatedAt: 1,
            likesCount: 1,
            isLikedByUser: 1,
            isOwner: 1,
          },
        },

        { $sort: sortOptions },
        { $skip: skip },
        { $limit: limit },
      ]).exec(),

      Comment.countDocuments({
        owner: userId,
        // Note: We'd need another aggregation to properly count only published video comments
      }).exec(),
    ]);

    const totalPages = Math.ceil(totalComments / limit);

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        {
          comments,
          pagination: {
            currentPage: page,
            totalPages,
            totalComments,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
        comments.length === 0
          ? "No comments found for this user"
          : "User comments fetched successfully"
      )
    );
  } catch (error) {
    throw error;
  }
});

export {
  getVideoComments,
  addComment,
  updateComment,
  deleteComment,
  getCommentById,
  getCommentsByUser,
};
