import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxLength: [500, "Comment cannot exceed 500 characters"],
      minLength: [1, "Comment cannot be empty"],
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: [true, "Video reference is required"],
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "flagged"],
      default: "approved",
    },
    flagCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.isDeleted;
        delete ret.deletedAt;
        delete ret.moderationStatus;
        delete ret.flagCount;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

commentSchema.index({ video: 1, createdAt: -1 });
commentSchema.index({ owner: 1, createdAt: -1 });
commentSchema.index({ video: 1, owner: 1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ moderationStatus: 1, createdAt: -1 });

commentSchema.index({ content: "text" });

commentSchema.virtual("repliesCount", {
  ref: "Comment",
  localField: "_id",
  foreignField: "parentComment",
  count: true,
});

commentSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

commentSchema.methods.markAsEdited = function () {
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

commentSchema.methods.flag = function () {
  this.flagCount += 1;
  if (this.flagCount >= 5) {
    this.moderationStatus = "flagged";
  }
  return this.save();
};

commentSchema.statics.findActiveComments = function (filter = {}) {
  return this.find({
    ...filter,
    isDeleted: { $ne: true },
    moderationStatus: { $in: ["approved", "pending"] },
  });
};

commentSchema.statics.findByVideoWithPagination = function (
  videoId,
  options = {}
) {
  const { page = 1, limit = 10, sortBy = "newest", userId = null } = options;

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

  const pipeline = [
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
        isDeleted: { $ne: true },
        moderationStatus: { $in: ["approved"] },
      },
    },
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
    {
      $project: {
        _id: 1,
        content: 1,
        video: 1,
        owner: 1,
        parentComment: 1,
        isEdited: 1,
        editedAt: 1,
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
  ];

  return this.aggregate(pipeline);
};

commentSchema.statics.getCommentStats = function (videoId) {
  return this.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
        isDeleted: { $ne: true },
        moderationStatus: "approved",
      },
    },
    {
      $group: {
        _id: null,
        totalComments: { $sum: 1 },
        uniqueCommenters: { $addToSet: "$owner" },
        latestComment: { $max: "$createdAt" },
        oldestComment: { $min: "$createdAt" },
      },
    },
    {
      $project: {
        _id: 0,
        totalComments: 1,
        uniqueCommentersCount: { $size: "$uniqueCommenters" },
        latestComment: 1,
        oldestComment: 1,
      },
    },
  ]);
};

commentSchema.pre("save", function (next) {
  if (this.content) {
    this.content = this.content.trim();
  }

  if (this.isModified("content") && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }

  next();
});

commentSchema.pre(/^find/, function (next) {
  if (!this.getQuery().isDeleted) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

commentSchema.pre("aggregate", function (next) {
  const pipeline = this.pipeline();
  const hasDeletedFilter = pipeline.some(
    (stage) => stage.$match && stage.$match.isDeleted !== undefined
  );

  if (!hasDeletedFilter) {
    this.pipeline().unshift({
      $match: { isDeleted: { $ne: true } },
    });
  }

  next();
});

commentSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.model("Comment", commentSchema);
