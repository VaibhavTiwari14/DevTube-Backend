import { Router } from "express";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const subscriptionRouter = Router();
subscriptionRouter.use(verifyJWT);

subscriptionRouter.route("/c/:channelId").get(getSubscribedChannels);
subscriptionRouter.route("/c/:channelId").post(toggleSubscription);

subscriptionRouter.route("/u/:subscriberId").get(getUserChannelSubscribers);

export default subscriptionRouter;
