import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    duration: {
      type: String,
      required: [true, "Duration is required"],
    },
    tags: {
      type: [String],
      default: [],
    },
    videoFile: {
      url: {
        type: String,
        required: [true, "Video URL is required"],
      },
      public_id: {
        type: String,
        required: [true, "Video public_id is required"],
      },
    },
    thumbnail: {
      url: {
        type: String,
        required: [true, "Thumbnail URL is required"],
      },
      public_id: {
        type: String,
        required: [true, "Thumbnail public_id is required"],
      },
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export const Video = mongoose.model("Video", videoSchema);
