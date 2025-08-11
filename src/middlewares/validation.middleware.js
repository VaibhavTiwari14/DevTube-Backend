import { body, param, query, validationResult } from "express-validator";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

// MongoDB ObjectId validation
export const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid ${paramName}`, [
        {
          field: paramName,
          message: `${paramName} must be a valid MongoDB ObjectId`,
        },
      ]);
    }
    next();
  };
};

// Generic validation middleware
export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    throw ApiError.validation("Validation failed", errors.array());
  };
};

// Pagination validation
export const validatePagination = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  query("sortBy").optional().isString(),
  query("order").optional().isIn(["asc", "desc"]),
];

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
