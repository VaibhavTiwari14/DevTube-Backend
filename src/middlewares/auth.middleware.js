import jwt from "jsonwebtoken";
import { User } from "../models/user.models.js";
import ApiError, { AuthorizationError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, _, next) => {
  const token =
    req.cookies.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    throw ApiError.badRequest("Access token missing or invalid");
  }
  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new AuthorizationError("User not found or unauthorized");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new AuthorizationError(error?.message || "Invalid or expired token");
  }
});
