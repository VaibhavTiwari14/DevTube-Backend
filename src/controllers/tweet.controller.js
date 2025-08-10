import { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import  asyncHandler  from "../utils/asyncHandler.js";

const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  DEFAULT_SORT_BY: "createdAt",
  DEFAULT_SORT_ORDER: "desc",
  ALLOWED_SORT_FIELDS: ["createdAt", "updatedAt", "content"],
  ALLOWED_SORT_ORDERS: ["asc", "desc"],
};

const TWEET_CONSTANTS = {
  MAX_CONTENT_LENGTH: 280,
  MIN_CONTENT_LENGTH: 1,
};

const validateAndSanitizePagination = (query) => {
  let { page, limit, sortBy, sortOrder } = query;

  // Validate and sanitize page
  page = Math.max(
    PAGINATION_CONSTANTS.DEFAULT_PAGE,
    parseInt(page) || PAGINATION_CONSTANTS.DEFAULT_PAGE
  );

  limit = Math.min(
    PAGINATION_CONSTANTS.MAX_LIMIT,
    Math.max(
      PAGINATION_CONSTANTS.MIN_LIMIT,
      parseInt(limit) || PAGINATION_CONSTANTS.DEFAULT_LIMIT
    )
  );

  if (!PAGINATION_CONSTANTS.ALLOWED_SORT_FIELDS.includes(sortBy)) {
    sortBy = PAGINATION_CONSTANTS.DEFAULT_SORT_BY;
  }

  if (
    !PAGINATION_CONSTANTS.ALLOWED_SORT_ORDERS.includes(sortOrder?.toLowerCase())
  ) {
    sortOrder = PAGINATION_CONSTANTS.DEFAULT_SORT_ORDER;
  }

  return { page, limit, sortBy, sortOrder: sortOrder.toLowerCase() };
};

const validateTweetContent = (content) => {
  if (!content || typeof content !== "string") {
    throw ApiError.badRequest("Tweet content is required and must be a string");
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length < TWEET_CONSTANTS.MIN_CONTENT_LENGTH) {
    throw ApiError.badRequest("Tweet content cannot be empty");
  }

  if (trimmedContent.length > TWEET_CONSTANTS.MAX_CONTENT_LENGTH) {
    throw ApiError.badRequest(
      `Tweet content cannot exceed ${TWEET_CONSTANTS.MAX_CONTENT_LENGTH} characters`
    );
  }

  return trimmedContent;
};

const validateObjectId = (id, fieldName = "ID") => {
  if (!id || !isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${fieldName}`);
  }
  return id;
};

const getAllTweets = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const { page, limit, sortBy, sortOrder } = validateAndSanitizePagination(
    req.query
  );

  const offset = (page - 1) * limit;
  const sortDirection = sortOrder === "desc" ? -1 : 1;

  try {
    const [tweets, total] = await Promise.all([
      Tweet.find()
        .sort({ [sortBy]: sortDirection })
        .skip(offset)
        .limit(limit)
        .populate("owner", "username avatar fullName")
        .select("-__v")
        .lean(),
      Tweet.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const executionTime = Date.now() - startTime;

    console.log(`getAllTweets executed in ${executionTime}ms`, {
      page,
      limit,
      sortBy,
      sortOrder,
      totalResults: tweets.length,
      totalDocuments: total,
    });

    return ApiResponse.success(res, {
      data: tweets,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
      meta: {
        sortBy,
        sortOrder,
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in getAllTweets:", error);
    throw ApiError.internalServerError(
      "Failed to retrieve tweets",
      error.message
    );
  }
});

const createTweet = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const content = validateTweetContent(req.body.content);

  const ownerId = req.user?._id;
  if (!ownerId || !isValidObjectId(ownerId)) {
    throw ApiError.unauthorized("Authentication required");
  }

  try {
    const owner = await User.findById(ownerId)
      .select("-password -refreshToken")
      .lean();

    if (!owner) {
      throw ApiError.notFound("User not found");
    }

    const recentTweetsCount = await Tweet.countDocuments({
      owner: ownerId,
      createdAt: { $gte: new Date(Date.now() - 60000) }, 
    });

    if (recentTweetsCount >= 5) {
      throw ApiError.tooManyRequests(
        "Rate limit exceeded. Please wait before posting another tweet."
      );
    }

    const tweet = await Tweet.create({
      content,
      owner: owner._id,
    });

    if (!tweet) {
      throw ApiError.internalServerError("Failed to create tweet");
    }

    const populatedTweet = await Tweet.findById(tweet._id)
      .populate("owner", "username avatar fullName")
      .select("-__v")
      .lean();

    const executionTime = Date.now() - startTime;

    console.log(`Tweet created in ${executionTime}ms`, {
      tweetId: tweet._id,
      ownerId: owner._id,
      contentLength: content.length,
    });

    return ApiResponse.success(
      res,
      {
        message: "Tweet created successfully",
        data: populatedTweet,
        meta: {
          executionTime: `${executionTime}ms`,
          timestamp: new Date().toISOString(),
        },
      },
      201
    );
  } catch (error) {
    console.error("Error in createTweet:", error);

    if (error.name === "ValidationError") {
      throw ApiError.badRequest("Invalid tweet data", error.message);
    }

    if (error.code === 11000) {
      throw ApiError.conflict("Duplicate tweet detected");
    }

    throw ApiError.internalServerError("Failed to create tweet", error.message);
  }
});

const getUserTweets = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const userId = validateObjectId(req.params.userId, "User ID");

  const { page, limit, sortBy, sortOrder } = validateAndSanitizePagination(
    req.query
  );
  const offset = (page - 1) * limit;
  const sortDirection = sortOrder === "desc" ? -1 : 1;

  try {
    const user = await User.findById(userId)
      .select("-password -refreshToken")
      .lean();

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const [tweets, total] = await Promise.all([
      Tweet.find({ owner: userId })
        .sort({ [sortBy]: sortDirection })
        .skip(offset)
        .limit(limit)
        .populate("owner", "username avatar fullName")
        .select("-__v")
        .lean(),
      Tweet.countDocuments({ owner: userId }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const executionTime = Date.now() - startTime;

    return ApiResponse.success(res, {
      data: tweets,
      user: {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        fullName: user.fullName,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
      meta: {
        sortBy,
        sortOrder,
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in getUserTweets:", error);
    throw ApiError.internalServerError(
      "Failed to retrieve user's tweets",
      error.message
    );
  }
});

const updateTweet = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const content = validateTweetContent(req.body.content);
  const tweetId = validateObjectId(req.params.tweetId, "Tweet ID");
  const userId = req.user?._id;

  if (!userId || !isValidObjectId(userId)) {
    throw ApiError.unauthorized("Authentication required");
  }

  try {
    const existingTweet = await Tweet.findById(tweetId).lean();

    if (!existingTweet) {
      throw ApiError.notFound("Tweet not found");
    }

    if (existingTweet.owner.toString() !== userId.toString()) {
      throw ApiError.forbidden("You can only update your own tweets");
    }

    const tweetAge = Date.now() - new Date(existingTweet.createdAt).getTime();
    const maxEditTime = 15 * 60 * 1000; // 15 minutes

    if (tweetAge > maxEditTime) {
      throw ApiError.forbidden(
        "Tweet can only be edited within 15 minutes of posting"
      );
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
      tweetId,
      {
        content,
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("owner", "username avatar fullName")
      .select("-__v")
      .lean();

    const executionTime = Date.now() - startTime;

    console.log(`Tweet updated in ${executionTime}ms`, {
      tweetId,
      userId,
      contentLength: content.length,
    });

    return ApiResponse.success(res, {
      message: "Tweet updated successfully",
      data: updatedTweet,
      meta: {
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in updateTweet:", error);

    if (error.name === "ValidationError") {
      throw ApiError.badRequest("Invalid tweet data", error.message);
    }

    throw ApiError.internalServerError("Failed to update tweet", error.message);
  }
});

const deleteTweet = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const tweetId = validateObjectId(req.params.tweetId, "Tweet ID");
  const userId = req.user?._id;

  if (!userId || !isValidObjectId(userId)) {
    throw ApiError.unauthorized("Authentication required");
  }

  try {
    const tweet = await Tweet.findById(tweetId).lean();

    if (!tweet) {
      throw ApiError.notFound("Tweet not found or already deleted");
    }

    if (tweet.owner.toString() !== userId.toString()) {
      throw ApiError.forbidden("You can only delete your own tweets");
    }

    await Tweet.findByIdAndDelete(tweetId);

    const executionTime = Date.now() - startTime;

    console.log(`Tweet deleted in ${executionTime}ms`, {
      tweetId,
      userId,
    });

    return ApiResponse.success(res, {
      message: "Tweet deleted successfully",
      meta: {
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in deleteTweet:", error);
    throw ApiError.internalServerError("Failed to delete tweet", error.message);
  }
});

export {
  createTweet,
  deleteTweet,
  getAllTweets,
  getUserTweets,
  updateTweet
};

