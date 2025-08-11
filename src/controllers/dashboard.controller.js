import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Video } from "../models/video.models.js";
import { Comment } from "../models/comment.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z
    .enum(["createdAt", "updatedAt", "views", "duration", "title", "likes"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  isPublished: z.coerce.boolean().optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const getChannelStats = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw ApiError.unauthorized("Authentication required");
  }

  const { startDate, endDate } = dateRangeSchema.parse(req.query);

  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  try {
    const session = await mongoose.startSession();

    const stats = await session.withTransaction(async () => {
      const userObjectId = new mongoose.Types.ObjectId(userId);

      const [
        videoStats,
        subscriberStats,
        likeStats,
        commentStats,
        recentActivity,
      ] = await Promise.all([
        Video.aggregate([
          {
            $match: {
              owner: userObjectId,
              ...dateFilter,
            },
          },
          {
            $facet: {
              overview: [
                {
                  $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                    totalDuration: { $sum: "$duration" },
                    publishedVideos: {
                      $sum: { $cond: [{ $eq: ["$isPublished", true] }, 1, 0] },
                    },
                    unpublishedVideos: {
                      $sum: { $cond: [{ $eq: ["$isPublished", false] }, 1, 0] },
                    },
                    avgDuration: { $avg: "$duration" },
                    latestVideo: { $max: "$createdAt" },
                    oldestVideo: { $min: "$createdAt" },
                    maxViews: { $max: "$views" },
                    minViews: { $min: "$views" },
                  },
                },
              ],
              topVideos: [
                { $match: { isPublished: true } },
                { $sort: { views: -1 } },
                { $limit: 5 },
                {
                  $project: {
                    title: 1,
                    views: 1,
                    thumbnail: 1,
                    createdAt: 1,
                    duration: 1,
                  },
                },
              ],
              monthlyStats: [
                {
                  $group: {
                    _id: {
                      year: { $year: "$createdAt" },
                      month: { $month: "$createdAt" },
                    },
                    videosCount: { $sum: 1 },
                    totalViews: { $sum: "$views" },
                  },
                },
                { $sort: { "_id.year": -1, "_id.month": -1 } },
                { $limit: 12 },
              ],
            },
          },
        ]).session(session),

        Subscription.aggregate([
          { $match: { channel: userObjectId } },
          {
            $facet: {
              total: [{ $count: "count" }],
              recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 30 },
                {
                  $group: {
                    _id: {
                      year: { $year: "$createdAt" },
                      month: { $month: "$createdAt" },
                      day: { $dayOfMonth: "$createdAt" },
                    },
                    count: { $sum: 1 },
                  },
                },
                { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
              ],
            },
          },
        ]).session(session),

        Like.aggregate([
          {
            $lookup: {
              from: "videos",
              localField: "video",
              foreignField: "_id",
              as: "videoDetails",
              pipeline: [
                { $match: { owner: userObjectId } },
                { $project: { _id: 1, title: 1, createdAt: 1 } },
              ],
            },
          },
          { $match: { videoDetails: { $ne: [] } } },
          { $unwind: "$videoDetails" },
          {
            $facet: {
              total: [{ $count: "count" }],
              recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 30 },
                {
                  $group: {
                    _id: {
                      year: { $year: "$createdAt" },
                      month: { $month: "$createdAt" },
                      day: { $dayOfMonth: "$createdAt" },
                    },
                    count: { $sum: 1 },
                  },
                },
              ],
              topLikedVideos: [
                {
                  $group: {
                    _id: "$video",
                    likesCount: { $sum: 1 },
                    videoTitle: { $first: "$videoDetails.title" },
                  },
                },
                { $sort: { likesCount: -1 } },
                { $limit: 5 },
              ],
            },
          },
        ]).session(session),

        Comment.aggregate([
          {
            $lookup: {
              from: "videos",
              localField: "video",
              foreignField: "_id",
              as: "videoDetails",
              pipeline: [
                { $match: { owner: userObjectId } },
                { $project: { _id: 1, title: 1 } },
              ],
            },
          },
          { $match: { videoDetails: { $ne: [] } } },
          {
            $facet: {
              total: [{ $count: "count" }],
              recent: [
                { $sort: { createdAt: -1 } },
                { $limit: 5 },
                {
                  $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "commenter",
                    pipeline: [{ $project: { username: 1, avatar: 1 } }],
                  },
                },
                { $unwind: "$commenter" },
                {
                  $project: {
                    content: { $substr: ["$content", 0, 100] },
                    commenter: 1,
                    createdAt: 1,
                    videoTitle: { $arrayElemAt: ["$videoDetails.title", 0] },
                  },
                },
              ],
            },
          },
        ]).session(session),

        Video.aggregate([
          { $match: { owner: userObjectId, isPublished: true } },
          { $sort: { createdAt: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: "likes",
              localField: "_id",
              foreignField: "video",
              as: "likes",
            },
          },
          {
            $lookup: {
              from: "comments",
              localField: "_id",
              foreignField: "video",
              as: "comments",
            },
          },
          {
            $project: {
              title: 1,
              views: 1,
              createdAt: 1,
              thumbnail: 1,
              likesCount: { $size: "$likes" },
              commentsCount: { $size: "$comments" },
              engagementRate: {
                $cond: {
                  if: { $gt: ["$views", 0] },
                  then: {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $add: [{ $size: "$likes" }, { $size: "$comments" }],
                          },
                          "$views",
                        ],
                      },
                      100,
                    ],
                  },
                  else: 0,
                },
              },
            },
          },
        ]).session(session),
      ]);

      const videoOverview = videoStats[0]?.overview[0] || {};
      const topVideos = videoStats[0]?.topVideos || [];
      const monthlyVideoStats = videoStats[0]?.monthlyStats || [];

      const subscriberTotal = subscriberStats[0]?.total[0]?.count || 0;
      const recentSubscribers = subscriberStats[0]?.recent || [];

      const likesTotal = likeStats[0]?.total[0]?.count || 0;
      const recentLikes = likeStats[0]?.recent || [];
      const topLikedVideos = likeStats[0]?.topLikedVideos || [];

      const commentsTotal = commentStats[0]?.total[0]?.count || 0;
      const recentComments = commentStats[0]?.recent || [];

      const overallEngagementRate =
        videoOverview.totalViews > 0
          ? ((likesTotal + commentsTotal) / videoOverview.totalViews) * 100
          : 0;

      return {
        overview: {
          totalVideos: videoOverview.totalVideos || 0,
          publishedVideos: videoOverview.publishedVideos || 0,
          unpublishedVideos: videoOverview.unpublishedVideos || 0,
          totalViews: videoOverview.totalViews || 0,
          totalDuration: Math.round(videoOverview.totalDuration || 0),
          averageDuration: Math.round(videoOverview.avgDuration || 0),
          averageViews:
            videoOverview.totalVideos > 0
              ? Math.round(videoOverview.totalViews / videoOverview.totalVideos)
              : 0,
          latestUpload: videoOverview.latestVideo || null,
          oldestUpload: videoOverview.oldestVideo || null,
          subscriberCount: subscriberTotal,
          totalLikes: likesTotal,
          totalComments: commentsTotal,
          engagementRate: Math.round(overallEngagementRate * 100) / 100,
        },
        analytics: {
          topPerformingVideos: topVideos,
          topLikedVideos: topLikedVideos.slice(0, 5),
          monthlyVideoStats: monthlyVideoStats,
          recentSubscriberActivity: recentSubscribers,
          recentLikeActivity: recentLikes,
          recentComments: recentComments,
          recentVideos: recentActivity,
        },
        performance: {
          viewsGrowth:
            monthlyVideoStats.length > 1
              ? (monthlyVideoStats[0]?.totalViews || 0) -
                (monthlyVideoStats[1]?.totalViews || 0)
              : 0,
          videosGrowth:
            monthlyVideoStats.length > 1
              ? (monthlyVideoStats[0]?.videosCount || 0) -
                (monthlyVideoStats[1]?.videosCount || 0)
              : 0,
          subscribersGrowth:
            recentSubscribers.length > 0
              ? recentSubscribers.reduce((sum, day) => sum + day.count, 0)
              : 0,
        },
      };
    });

    await session.endSession();

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(stats, "Channel statistics fetched successfully")
    );
  } catch (error) {
    throw ApiError.internal("Failed to fetch channel statistics");
  }
});

const getChannelVideos = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw ApiError.unauthorized("Authentication required");
  }

  const validatedQuery = paginationSchema.safeParse(req.query);
  if (!validatedQuery.success) {
    const errorMessage =
      validatedQuery.error.errors[0]?.message || "Invalid query parameters";
    throw ApiError.badRequest(errorMessage);
  }

  const { page, limit, sortBy, order, isPublished } = validatedQuery.data;
  const { search, category, duration } = req.query;

  try {
    const query = { owner: userId };

    if (typeof isPublished === "boolean") {
      query.isPublished = isPublished;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (duration) {
      switch (duration) {
        case "short": // < 4 minutes
          query.duration = { $lt: 240 };
          break;
        case "medium": // 4-20 minutes
          query.duration = { $gte: 240, $lte: 1200 };
          break;
        case "long": // > 20 minutes
          query.duration = { $gt: 1200 };
          break;
      }
    }

    const skip = (page - 1) * limit;

    let sortOptions = {};
    if (sortBy === "likes") {
      sortOptions = { likesCount: order === "desc" ? -1 : 1 };
    } else {
      sortOptions[sortBy] = order === "desc" ? -1 : 1;
    }

    const aggregationPipeline = [
      { $match: query },

      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
        },
      },

      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "video",
          as: "comments",
        },
      },

      {
        $addFields: {
          likesCount: { $size: "$likes" },
          commentsCount: { $size: "$comments" },
          engagementRate: {
            $cond: {
              if: { $gt: ["$views", 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $add: [{ $size: "$likes" }, { $size: "$comments" }] },
                      "$views",
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },

      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          thumbnail: 1,
          videoFile: 1,
          duration: 1,
          views: 1,
          isPublished: 1,
          category: 1,
          createdAt: 1,
          updatedAt: 1,
          likesCount: 1,
          commentsCount: 1,
          engagementRate: { $round: ["$engagementRate", 2] },
        },
      },

      { $sort: sortOptions },
    ];

    const [videos, totalCount] = await Promise.all([
      Video.aggregate([
        ...aggregationPipeline,
        { $skip: skip },
        { $limit: limit },
      ]),
      Video.aggregate([...aggregationPipeline, { $count: "total" }]),
    ]);

    const total = totalCount[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    const videoStats = {
      published: videos.filter((v) => v.isPublished).length,
      unpublished: videos.filter((v) => !v.isPublished).length,
      totalViews: videos.reduce((sum, v) => sum + (v.views || 0), 0),
      totalLikes: videos.reduce((sum, v) => sum + (v.likesCount || 0), 0),
      totalComments: videos.reduce((sum, v) => sum + (v.commentsCount || 0), 0),
      averageEngagement:
        videos.length > 0
          ? videos.reduce((sum, v) => sum + (v.engagementRate || 0), 0) /
            videos.length
          : 0,
    };

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(
        {
          videos,
          stats: videoStats,
          pagination: {
            currentPage: page,
            totalPages,
            totalVideos: total,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? page + 1 : null,
            prevPage: hasPrevPage ? page - 1 : null,
            limit,
          },
          filters: {
            search: search || null,
            category: category || null,
            duration: duration || null,
            isPublished,
            sortBy,
            order,
          },
        },
        total === 0
          ? "No videos found matching the criteria"
          : `${videos.length} video(s) fetched successfully`
      )
    );
  } catch (error) {
    throw ApiError.internal("Failed to fetch channel videos");
  }
});

const getVideoAnalytics = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { videoId } = req.params;

  if (!userId) {
    throw ApiError.unauthorized("Authentication required");
  }

  if (!isValidObjectId(videoId)) {
    throw ApiError.badRequest("Invalid video ID provided");
  }

  try {
    const video = await Video.findOne({
      _id: videoId,
      owner: userId,
    }).lean();

    if (!video) {
      throw ApiError.notFound("Video not found or access denied");
    }

    const [analytics] = await Video.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(videoId) } },

      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "likedBy",
                foreignField: "_id",
                as: "user",
                pipeline: [{ $project: { username: 1, avatar: 1 } }],
              },
            },
            { $unwind: "$user" },
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
          ],
        },
      },

      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "video",
          as: "comments",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "commenter",
                pipeline: [{ $project: { username: 1, avatar: 1 } }],
              },
            },
            { $unwind: "$commenter" },
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                content: 1,
                commenter: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },

      {
        $addFields: {
          likesCount: { $size: "$likes" },
          commentsCount: { $size: "$comments" },
          engagementRate: {
            $cond: {
              if: { $gt: ["$views", 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $add: [{ $size: "$likes" }, { $size: "$comments" }] },
                      "$views",
                    ],
                  },
                  100,
                ],
              },
              else: 0,
            },
          },
        },
      },

      {
        $project: {
          title: 1,
          description: 1,
          thumbnail: 1,
          duration: 1,
          views: 1,
          isPublished: 1,
          createdAt: 1,
          updatedAt: 1,
          likesCount: 1,
          commentsCount: 1,
          engagementRate: { $round: ["$engagementRate", 2] },
          recentLikes: { $slice: ["$likes", 10] },
          recentComments: { $slice: ["$comments", 10] },
        },
      },
    ]);

    if (!analytics) {
      throw ApiError.notFound("Video analytics not found");
    }

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(analytics, "Video analytics fetched successfully")
    );
  } catch (error) {
    throw ApiError.internal("Failed to fetch video analytics");
  }
});

const getDashboardSummary = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw ApiError.unauthorized("Authentication required");
  }

  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [summary] = await User.aggregate([
      { $match: { _id: userObjectId } },

      {
        $lookup: {
          from: "videos",
          localField: "_id",
          foreignField: "owner",
          as: "allVideos",
        },
      },

      {
        $lookup: {
          from: "videos",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$owner", "$$userId"] } } },
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          ],
          as: "recentVideos",
        },
      },

      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },

      {
        $lookup: {
          from: "subscriptions",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$channel", "$$userId"] } } },
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          ],
          as: "recentSubscribers",
        },
      },

      {
        $project: {
          username: 1,
          fullName: 1,
          email: 1,
          avatar: 1,
          coverImage: 1,
          createdAt: 1,
          totalVideos: { $size: "$allVideos" },
          publishedVideos: {
            $size: {
              $filter: {
                input: "$allVideos",
                cond: { $eq: ["$$this.isPublished", true] },
              },
            },
          },
          totalViews: { $sum: "$allVideos.views" },
          recentVideosCount: { $size: "$recentVideos" },
          totalSubscribers: { $size: "$subscribers" },
          recentSubscribersCount: { $size: "$recentSubscribers" },
        },
      },
    ]);

    if (!summary) {
      throw ApiError.notFound("User not found");
    }

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(summary, "Dashboard summary fetched successfully")
    );
  } catch (error) {
    throw ApiError.internal("Failed to fetch dashboard summary");
  }
});

export {
  getChannelStats,
  getChannelVideos,
  getVideoAnalytics,
  getDashboardSummary,
};
