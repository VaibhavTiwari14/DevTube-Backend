import { Router } from "express";
import {
  getChannelStats,
  getChannelVideos,
  getVideoAnalytics,
  getDashboardSummary,
} from "../controllers/dashboard.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { validateObjectId } from "../middlewares/validation.middleware.js";

const dashboardRouter = Router();

dashboardRouter.use(verifyJWT);

dashboardRouter.route("/").get(getDashboardSummary);

dashboardRouter.route("/stats").get(getChannelStats);

dashboardRouter.route("/videos").get(getChannelVideos);

dashboardRouter
  .route("/videos/:videoId/analytics")
  .get(validateObjectId("videoId"), getVideoAnalytics);

export default dashboardRouter;
