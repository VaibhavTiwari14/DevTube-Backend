import { body, param, query, validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

export const validateVideo = [
  body("title")
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3-100 characters"),
  body("description")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10-1000 characters"),

  (req, _, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.validation("Validation failed", errors.array());
    }
    next();
  },
];

export const validateVideoId = [
  param("videoId").isMongoId().withMessage("Invalid video ID"),

  (req, _, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw ApiError.badRequest("Invalid video ID");
    }
    next();
  },
];
