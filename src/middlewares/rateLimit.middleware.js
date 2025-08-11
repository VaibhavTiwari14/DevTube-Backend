import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

const rateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      throw new ApiError(
        429,
        "Too Many Requests",
        "Rate limit exceeded, please try again later"
      );
    },
  };

  return rateLimit({
    ...defaultOptions,
    ...options,
  });
};

// More restrictive limiter for auth routes
export const authLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: "Too many login attempts, please try again after an hour",
});

// Limiter for API routes
export const apiLimiter = rateLimiter();

// Specific limiter for video uploads
export const uploadLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 uploads per hour
  message: "Upload limit reached, please try again later",
});

export default rateLimiter;
