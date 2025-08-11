import { Router } from "express";
import { query } from "express-validator";
import {
  getChannelStats,
  getChannelVideos,
  getDashboardSummary,
  getVideoAnalytics,
} from "../controllers/dashboard.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  validate,
  validateObjectId,
  validatePagination,
} from "../middlewares/validation.middleware.js";

const dashboardRouter = Router();

dashboardRouter.use(verifyJWT);

dashboardRouter.route("/").get(getDashboardSummary);

// Channel statistics with date range validation
dashboardRouter
  .route("/stats")
  .get(
    validate([
      query("startDate")
        .optional()
        .isISO8601()
        .withMessage("Invalid start date format"),
      query("endDate")
        .optional()
        .isISO8601()
        .withMessage("Invalid end date format"),
    ]),
    getChannelStats
  );

// Channel videos with pagination and filters
dashboardRouter
  .route("/videos")
  .get(
    validate([
      ...validatePagination,
      query("isPublished").optional().isBoolean().toBoolean(),
      query("searchQuery").optional().trim().isLength({ max: 100 }),
    ]),
    getChannelVideos
  );

// Video analytics with ObjectId validation and date range
dashboardRouter
  .route("/videos/:videoId/analytics")
  .get(
    validateObjectId("videoId"),
    validate([
      query("startDate")
        .optional()
        .isISO8601()
        .withMessage("Invalid start date format"),
      query("endDate")
        .optional()
        .isISO8601()
        .withMessage("Invalid end date format"),
      query("metric")
        .optional()
        .isIn(["views", "likes", "comments"])
        .withMessage("Invalid metric"),
    ]),
    getVideoAnalytics
  );

export default dashboardRouter;
