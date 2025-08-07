import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 10), 50);
    const query = req.query.query?.trim() || "";

    const allowedSortFields = [
      "createdAt",
      "views",
      "title",
      "duration",
      "updatedAt",
    ];
    const sortBy = allowedSortFields.includes(req.query.sortBy)
      ? req.query.sortBy
      : "createdAt";

    const sortType = req.query.sortType === "asc" ? 1 : -1;
    const userId = req.query.userId?.trim();

    if (userId && !isValidObjectId(userId)) {
      throw ApiError.badRequest("Invalid user ID provided");
    }

    if (query && query.length > 100) {
      throw ApiError.badRequest("Search query too long (max 100 characters)");
    }

    const matchQuery = {
      isPublished: true,
    };

    if (query) {
      matchQuery.$or = [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ];
    }

    if (userId) {
      matchQuery.owner = new mongoose.Types.ObjectId(userId);
    }

    const videosAggregate = Video.aggregate([
      {
        $match: matchQuery,
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerDetails",
          pipeline: [
            {
              $project: {
                _id: 1,
                fullName: 1,
                avatar: 1,
                username: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$ownerDetails",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          videoFile: 1,
          thumbnail: 1,
          title: 1,
          description: 1,
          views: 1,
          duration: 1,
          isPublished: 1,
          createdAt: 1,
          updatedAt: 1,
          owner: {
            _id: "$ownerDetails._id",
            fullName: "$ownerDetails.fullName",
            avatar: "$ownerDetails.avatar",
            username: "$ownerDetails.username",
          },
        },
      },
      {
        $sort: {
          [sortBy]: sortType,
        },
      },
    ]);

    const options = {
      page,
      limit,
      customLabels: {
        totalDocs: "totalVideos",
        docs: "videos",
        limit: "limit",
        page: "currentPage",
        nextPage: "nextPage",
        prevPage: "prevPage",
        totalPages: "totalPages",
        pagingCounter: "serialNo",
        meta: "pagination",
      },
    };

    const result = await Video.aggregatePaginate(videosAggregate, options);

    if (!result.videos || result.videos.length === 0) {
      return ApiResponse.sendResponse(
        res,
        ApiResponse.ok(
          {
            videos: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalVideos: 0,
              limit: limit,
            },
          },
          "No videos found"
        )
      );
    }

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        result,
        `Videos fetched successfully${query ? ` for search: "${query}"` : ""}${userId ? " for specified user" : ""}`
      )
    );
  } catch (error) {
    console.error("Error in getAllVideos:", error);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error.name === "CastError") {
      throw ApiError.badRequest("Invalid data format provided");
    }

    if (error.name === "ValidationError") {
      throw ApiError.validation(`Validation error: ${error.message}`);
    }

    throw ApiError.internal("Internal server error while fetching videos");
  }
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
