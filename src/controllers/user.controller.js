import fs from "fs/promises";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { DEFAULT_AVATAR_URL, DEFAULT_COVER_URL } from "../constants.js";
import { User } from "../models/user.models.js";
import ApiError, {
  AuthenticationError,
  DatabaseError,
  ValidationError,
} from "../utils/ApiError.js";
import ApiResponse, { SuccessResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const userSchema = z.object({
  fullname: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(50, "Full name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Full name can only contain letters and spaces"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address")
    .max(255, "Email must be less than 255 characters"),

  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .regex(/^[a-zA-Z]/, "Username must start with a letter"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters") 
    .max(128, "Password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const updateDetailsSchema = z.object({
  fullname: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(50, "Full name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Full name can only contain letters and spaces")
    .optional(),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address")
    .max(255, "Email must be less than 255 characters")
    .optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "New password must be less than 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "New password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT = 30000;

const validateFile = (file, fieldName) => {
  if (!file) return true;

  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    throw new ValidationError(
      `Invalid ${fieldName} format. Only JPEG, PNG, and WebP are allowed.`
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new ValidationError(`${fieldName} size must be less than 5MB.`);
  }

  if (!file.path) {
    throw new ValidationError(
      `${fieldName} upload failed. No file path found.`
    );
  }

  return true;
};

const safeDeleteFile = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
  } catch (error) {
    console.warn(`Could not delete file ${filePath}:`, error.message);
  }
};

const handleFileUpload = async (files, fieldName, defaultUrl = null) => {
  const file = files?.[fieldName]?.[0];

  if (!file) {
    return defaultUrl;
  }

  let uploadResult = null;

  try {
    validateFile(file, fieldName);

    const uploadPromise = uploadOnCloudinary(file.path);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Upload timeout")), UPLOAD_TIMEOUT);
    });

    uploadResult = await Promise.race([uploadPromise, timeoutPromise]);

    if (!uploadResult || !uploadResult.secure_url) {
      throw new Error("Invalid upload response from Cloudinary");
    }

    await safeDeleteFile(file.path);

    return uploadResult.secure_url;
  } catch (error) {
    if (file?.path) {
      await safeDeleteFile(file.path);
    }

    console.error(`File upload failed for ${fieldName}:`, {
      error: error.message,
      fileName: file?.originalname,
      fileSize: file?.size,
      mimetype: file?.mimetype,
    });

    return defaultUrl;
  }
};

const checkUserExists = async (email, username) => {
  const existingUsers = await User.find({
    $or: [{ email }, { username }],
  })
    .select("email username")
    .lean();

  if (existingUsers.length === 0) {
    return null;
  }

  const conflicts = [];
  const emailExists = existingUsers.some((user) => user.email === email);
  const usernameExists = existingUsers.some(
    (user) => user.username === username
  );

  if (emailExists) {
    conflicts.push({ field: "email", message: "Email already in use" });
  }

  if (usernameExists) {
    conflicts.push({ field: "username", message: "Username already in use" });
  }

  return {
    message: "User with this email or username already exists",
    conflicts,
  };
};

const cleanupUploadedFiles = async (files) => {
  if (!files) return;

  const cleanupPromises = [];

  if (files.avatar?.[0]?.path) {
    cleanupPromises.push(safeDeleteFile(files.avatar[0].path));
  }

  if (files.coverImage?.[0]?.path) {
    cleanupPromises.push(safeDeleteFile(files.coverImage[0].path));
  }

  await Promise.allSettled(cleanupPromises);
};

const generateAccessAndRefreshToken = async (user) => {
  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating tokens:", error);
    throw new DatabaseError(
      "Failed to generate access and refresh tokens",
      error
    );
  }
};

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new AuthenticationError("Refresh token is required"); // FIX: Use AuthenticationError
  }

  let user;

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    user = await User.findById(decodedToken?._id);

    if (!user || incomingRefreshToken !== user.refreshToken) {
      throw new AuthenticationError("Invalid or expired refresh token");
    }
  } catch (error) {
    throw new AuthenticationError("Invalid or expired refresh token");
  }

  const { accessToken, refreshToken } =
    await generateAccessAndRefreshToken(user); // FIX: Get both tokens

  const option = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict", // FIX: Added for security
    maxAge: 24 * 60 * 60 * 1000, // FIX: Added expiry
  };

  res.cookie("accessToken", accessToken, option);
  res.cookie("refreshToken", refreshToken, option); // FIX: Use new refresh token

  console.info("Access token refreshed:", {
    userId: user._id,
    email: user.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { accessToken, refreshToken },
      "Access token refreshed successfully."
    )
  );
});

const registerUser = asyncHandler(async (req, res) => {
  const validatedData = userSchema.safeParse(req.body);
  if (!validatedData.success) {
    await cleanupUploadedFiles(req.files);

    const validationErrors = validatedData.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    throw new ValidationError(
      "Validation failed for register user.",
      validationErrors
    );
  }

  const { fullname, email, username, password } = validatedData.data;

  const userConflict = await checkUserExists(email, username);

  if (userConflict) {
    await cleanupUploadedFiles(req.files);
    throw ValidationError.conflict(
      userConflict.message,
      userConflict.conflicts
    );
  }

  const [avatarUrl, coverImageUrl] = await Promise.allSettled([
    handleFileUpload(req.files, "avatar", DEFAULT_AVATAR_URL),
    handleFileUpload(req.files, "coverImage", DEFAULT_COVER_URL),
  ]);

  const finalAvatarUrl =
    avatarUrl.status === "fulfilled" ? avatarUrl.value : DEFAULT_AVATAR_URL;
  const finalCoverImageUrl =
    coverImageUrl.status === "fulfilled"
      ? coverImageUrl.value
      : DEFAULT_COVER_URL;

  let dbUserRegisterResponse;

  try {
    dbUserRegisterResponse = await User.create({
      fullname,
      email,
      password,
      username,
      avatar: finalAvatarUrl,
      coverImage: finalCoverImageUrl,
    });
  } catch (error) {
    console.error("Database error during user creation:", {
      error: error.message,
      code: error.code,
      username,
      email,
    });

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const conflictError = new ValidationError(`${field} already exists`);
      conflictError.addError(field, `This ${field} is already taken`);
      throw conflictError;
    }

    throw new DatabaseError("Failed to create user in database", error.message);
  }

  const createdUser = await User.findById(dbUserRegisterResponse._id)
    .select("-password -refreshToken")
    .lean();

  if (!createdUser) {
    console.error("User creation verification failed:", {
      userId: dbUserRegisterResponse._id,
      timestamp: new Date().toISOString(),
    });

    throw new DatabaseError(
      "User registration failed. Could not verify user creation in the database."
    );
  }

  console.info("User registered successfully:", {
    userId: createdUser._id,
    username: createdUser.username,
    email: createdUser.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.created(createdUser, "User registered successfully.")
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const validatedData = loginSchema.safeParse(req.body);

  if (!validatedData.success) {
    const validationErrors = validatedData.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new ValidationError("Validation failed", validationErrors);
  }

  const { email, password } = validatedData.data;

  const user = await User.findOne({ email });
  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new AuthenticationError("Invalid email or password");
  }

  const { accessToken, refreshToken } =
    await generateAccessAndRefreshToken(user);

  const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken")
    .lean();

  if (!loggedInUser) {
    console.error("User login verification failed:", {
      userId: user._id,
      timestamp: new Date().toISOString(),
    });
    throw new DatabaseError(
      "User login failed. Could not verify user in the database."
    );
  }

  const cookieOptions = {
    // FIX: Enhanced cookie security
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  };

  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);

  console.info("User logged in successfully:", {
    userId: loggedInUser._id,
    username: loggedInUser.username,
    email: loggedInUser.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  // FIX 5: Corrected response class usage
  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(
      { user: loggedInUser, accessToken, refreshToken },
      "User logged in successfully."
    )
  );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const cookieOptions = {
    // FIX: Enhanced cookie security
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  res
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions);

  console.info("User logged out successfully:", {
    // FIX: Added logging
    userId: req.user._id,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    new SuccessResponse(null, "User logged out successfully")
  );
});

const changePassword = asyncHandler(async (req, res) => {
  const validatedData = changePasswordSchema.safeParse(req.body);

  if (!validatedData.success) {
    const validationErrors = validatedData.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new ValidationError("Validation failed", validationErrors);
  }

  const { oldPassword, newPassword } = validatedData.data;

  if (oldPassword === newPassword) {
    throw new ValidationError(
      "New password must be different from old password",
      [
        {
          field: "newPassword",
          message: "New password must not match old password",
        },
      ]
    );
  }

  const user = await User.findById(req.user?._id);
  if (!user || !(await user.isPasswordCorrect(oldPassword))) {
    throw new AuthenticationError("Old password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  console.info("Password changed successfully:", {
    // FIX: Added logging
    userId: user._id,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    new SuccessResponse(null, "Password changed successfully")
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return ApiResponse.sendResponse(
    res,
    new SuccessResponse(req.user, "Current user details")
  );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const validatedData = updateDetailsSchema.safeParse(req.body);

  if (!validatedData.success) {
    const validationErrors = validatedData.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new ValidationError(
      "Validation failed for account details update.",
      validationErrors
    );
  }

  const { fullname, email } = validatedData.data;

  if (!fullname && !email) {
    throw new ValidationError(
      "At least one field (fullname or email) is required to update",
      [{ field: "general", message: "No fields provided for update" }]
    );
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new DatabaseError("User not found");
  }

  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      throw new ValidationError("Email already exists", [
        { field: "email", message: "Email is already in use" },
      ]);
    }
  }

  if (fullname) user.fullname = fullname;
  if (email) user.email = email;

  await user.save({ validateBeforeSave: false });

  const updatedUser = await User.findById(user._id)
    .select("-password -refreshToken")
    .lean();

  if (!updatedUser) {
    console.error("User update verification failed:", {
      userId: user._id,
      timestamp: new Date().toISOString(),
    });
    throw new DatabaseError(
      "User update failed. Could not verify user in the database."
    );
  }

  console.info("User details updated successfully:", {
    userId: updatedUser._id,
    username: updatedUser.username,
    email: updatedUser.email,
    updatedFields: { fullname: !!fullname, email: !!email }, // FIX: Log what was updated
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(updatedUser, "User details updated successfully.")
  );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new DatabaseError("User not found");
  }

  const avatarUrl = await handleFileUpload(req.files, "avatar", user.avatar);

  if (avatarUrl === user.avatar) {
    const currentUser = await User.findById(user._id)
      .select("-password -refreshToken")
      .lean();

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(currentUser, "Avatar already up to date")
    );
  }

  user.avatar = avatarUrl;
  await user.save({ validateBeforeSave: false });

  const updatedUser = await User.findById(user._id)
    .select("-password -refreshToken")
    .lean();

  if (!updatedUser) {
    console.error("User avatar update verification failed:", {
      userId: user._id,
      timestamp: new Date().toISOString(),
    });
    throw new DatabaseError(
      "User avatar update failed. Could not verify user in the database."
    );
  }

  console.info("User avatar updated successfully:", {
    userId: updatedUser._id,
    username: updatedUser.username,
    email: updatedUser.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(updatedUser, "Avatar updated successfully.")
  );
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new DatabaseError("User not found");
  }

  // FIX: Correct file access pattern
  const coverImageUrl = await handleFileUpload(
    req.files,
    "coverImage",
    user.coverImage
  );

  if (coverImageUrl === user.coverImage) {
    const currentUser = await User.findById(user._id)
      .select("-password -refreshToken")
      .lean();

    return ApiResponse.sendResponse(
      res,
      ApiResponse.ok(currentUser, "Cover image already up to date")
    );
  }

  user.coverImage = coverImageUrl;
  await user.save({ validateBeforeSave: false });

  const updatedUser = await User.findById(user._id)
    .select("-password -refreshToken")
    .lean();

  if (!updatedUser) {
    console.error("User cover image update verification failed:", {
      userId: user._id,
      timestamp: new Date().toISOString(),
    });
    throw new DatabaseError(
      "User cover image update failed. Could not verify user in the database."
    );
  }

  console.info("User cover image updated successfully:", {
    userId: updatedUser._id,
    username: updatedUser.username,
    email: updatedUser.email,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(updatedUser, "Cover image updated successfully.")
  );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim() || typeof username !== "string") {
    throw new ValidationError("Username is required to fetch channel profile");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username.trim().toLowerCase(),
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
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        username: 1,
        fullname: 1,
        avatar: 1,
        coverImage: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        email: 1,
      },
    },
  ]);

  if (!channel || channel.length === 0) {
    return ApiError.notFound(`Channel with username ${username} not found`);
  }

  console.info("Channel profile fetched successfully:", {
    username: channel[0].username,
    userId: channel[0]._id,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
    timestamp: new Date().toISOString(),
  });

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(channel[0], "Channel profile fetched successfully")
  );
});

const getUserWatchHistory = asyncHandler(async (req, res) => {
  const user = User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullname: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  if (!user || user.length === 0) {
    return ApiError.notFound("User not found or has no watch history");
  }

  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok(user[0]?.watchHistory, "Watch history fetched successfully")
  );
});

export {
  changePassword,
  cleanupUploadedFiles,
  generateAccessAndRefreshToken,
  getCurrentUser,
  getUserChannelProfile,
  getUserWatchHistory,
  handleFileUpload,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
