import { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const validateObjectId = (id, fieldName = "ID") => {
  if (!id || !isValidObjectId(id)) {
    throw ApiError.badRequest(`Invalid ${fieldName}`);
  }
  return id;
};

const validatePagination = (query) => {
  let {
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = query;

  page = Math.max(1, parseInt(page) || 1);
  limit = Math.min(100, Math.max(1, parseInt(limit) || 20));

  const allowedSortFields = ["createdAt", "updatedAt"];
  if (!allowedSortFields.includes(sortBy)) {
    sortBy = "createdAt";
  }

  if (!["asc", "desc"].includes(sortOrder?.toLowerCase())) {
    sortOrder = "desc";
  }

  return { page, limit, sortBy, sortOrder: sortOrder.toLowerCase() };
};

const checkUserExists = async (userId) => {
  const user = await User.findById(userId)
    .select("_id fullName username avatar")
    .lean();

  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return user;
};

const toggleSubscription = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const channelId = validateObjectId(req.params.channelId, "Channel ID");
  const subscriberId = req.user?._id;

  if (!subscriberId || !isValidObjectId(subscriberId)) {
    throw ApiError.unauthorized("Authentication required");
  }

  if (channelId === subscriberId.toString()) {
    throw ApiError.badRequest("You cannot subscribe to your own channel");
  }

  try {
    const [channel, subscriber] = await Promise.all([
      checkUserExists(channelId),
      checkUserExists(subscriberId),
    ]);

    const existingSubscription = await Subscription.findOne({
      channel: channelId,
      subscriber: subscriberId,
    }).lean();

    let action;
    let subscriptionData = null;

    if (existingSubscription) {
      await Subscription.findByIdAndDelete(existingSubscription._id);
      action = "unsubscribed";
    } else {
      const newSubscription = await Subscription.create({
        channel: channelId,
        subscriber: subscriberId,
      });

      subscriptionData = {
        _id: newSubscription._id,
        channel: {
          _id: channel._id,
          fullName: channel.fullName,
          username: channel.username,
          avatar: channel.avatar,
        },
        subscribedAt: newSubscription.createdAt,
      };

      action = "subscribed";
    }

    const executionTime = Date.now() - startTime;

    console.log(
      `Subscription ${action}: ${subscriberId} -> ${channelId} (${executionTime}ms)`
    );

    return ApiResponse.success(res, {
      message: `Successfully ${action} ${action === "subscribed" ? "to" : "from"} channel`,
      data: {
        action,
        subscription: subscriptionData,
      },
      meta: {
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in toggleSubscription:", error);

    if (error.code === 11000) {
      throw ApiError.conflict(
        "Subscription operation in progress, please try again"
      );
    }

    throw ApiError.internalServerError(
      "Failed to toggle subscription",
      error.message
    );
  }
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const channelId = validateObjectId(req.params.channelId, "Channel ID");
  const { page, limit, sortBy, sortOrder } = validatePagination(req.query);

  const offset = (page - 1) * limit;
  const sortDirection = sortOrder === "desc" ? -1 : 1;

  try {
    await checkUserExists(channelId);

    const [subscribers, total] = await Promise.all([
      Subscription.find({ channel: channelId })
        .populate("subscriber", "_id fullName avatar username")
        .select("subscriber createdAt")
        .sort({ [sortBy]: sortDirection })
        .skip(offset)
        .limit(limit)
        .lean(),
      Subscription.countDocuments({ channel: channelId }),
    ]);

    const formattedSubscribers = subscribers.map((sub) => ({
      _id: sub._id,
      subscriber: sub.subscriber,
      subscribedAt: sub.createdAt,
    }));

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const executionTime = Date.now() - startTime;

    return ApiResponse.success(res, {
      data: formattedSubscribers,
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
    console.error("Error in getUserChannelSubscribers:", error);
    throw ApiError.internalServerError(
      "Failed to fetch channel subscribers",
      error.message
    );
  }
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const subscriberId = req.params.userId || req.user?._id;

  if (!subscriberId || !isValidObjectId(subscriberId)) {
    throw ApiError.badRequest("Invalid subscriber ID");
  }

  const { page, limit, sortBy, sortOrder } = validatePagination(req.query);

  const offset = (page - 1) * limit;
  const sortDirection = sortOrder === "desc" ? -1 : 1;

  try {
    const user = await checkUserExists(subscriberId);

    const [subscriptions, total] = await Promise.all([
      Subscription.find({ subscriber: subscriberId })
        .populate("channel", "_id fullName avatar username")
        .select("channel createdAt")
        .sort({ [sortBy]: sortDirection })
        .skip(offset)
        .limit(limit)
        .lean(),
      Subscription.countDocuments({ subscriber: subscriberId }),
    ]);

    const formattedSubscriptions = subscriptions.map((sub) => ({
      _id: sub._id,
      channel: sub.channel,
      subscribedAt: sub.createdAt,
    }));

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const executionTime = Date.now() - startTime;

    return ApiResponse.success(res, {
      data: formattedSubscriptions,
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        avatar: user.avatar,
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
    console.error("Error in getSubscribedChannels:", error);
    throw ApiError.internalServerError(
      "Failed to fetch subscribed channels",
      error.message
    );
  }
});

const getSubscriptionStatus = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const channelId = validateObjectId(req.params.channelId, "Channel ID");
  const subscriberId = req.user?._id;

  if (!subscriberId || !isValidObjectId(subscriberId)) {
    throw ApiError.unauthorized("Authentication required");
  }

  try {
    const subscription = await Subscription.findOne({
      channel: channelId,
      subscriber: subscriberId,
    })
      .select("createdAt")
      .lean();

    const executionTime = Date.now() - startTime;

    return ApiResponse.success(res, {
      data: {
        isSubscribed: !!subscription,
        subscribedAt: subscription?.createdAt || null,
        channelId,
        subscriberId,
      },
      meta: {
        executionTime: `${executionTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error in getSubscriptionStatus:", error);
    throw ApiError.internalServerError(
      "Failed to check subscription status",
      error.message
    );
  }
});

export {
  toggleSubscription,
  getUserChannelSubscribers,
  getSubscribedChannels,
  getSubscriptionStatus,
};
