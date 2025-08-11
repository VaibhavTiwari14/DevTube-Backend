import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import {
  CACHE_DURATIONS,
  cacheMiddleware,
} from "./middlewares/cache.middleware.js";
import errorHandler from "./middlewares/errors.middleware.js";
import {
  captureResponseBody,
  errorLogger,
  requestLogger,
  requestLoggerDev,
} from "./middlewares/logger.middleware.js";
import {
  apiLimiter,
  authLimiter,
  uploadLimiter,
} from "./middlewares/rateLimit.middleware.js";
import commentRouter from "./routes/comment.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import healthCheckRouter from "./routes/healthCheck.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(
  express.json({
    limit: "16kb",
    strict: true,
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb",
  })
);

app.use(express.static("public"));

app.use(cookieParser());

app.use(captureResponseBody);

if (process.env.NODE_ENV === "development") {
  app.use(requestLoggerDev);
} else {
  app.use(requestLogger);
}

// Apply rate limiting to all API routes
app.use("/api/v1/", apiLimiter);

// Cache public routes
app.use("/api/v1/videos", cacheMiddleware(CACHE_DURATIONS.SHORT), videoRouter);
app.use("/api/v1/healthCheck", healthCheckRouter);

// Apply auth rate limiting to authentication routes
app.use("/api/v1/users/login", authLimiter);
app.use("/api/v1/users/register", authLimiter);
app.use("/api/v1/users", userRouter);

// Apply upload rate limiting to video uploads
app.use("/api/v1/videos/upload", uploadLimiter);

// Regular routes with standard rate limiting
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/comments", commentRouter);
app.use(
  "/api/v1/dashboard",
  cacheMiddleware(CACHE_DURATIONS.SHORT),
  dashboardRouter
);

app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
    });
  } else {
    return res
      .status(404)
      .sendFile(process.cwd() + "/public/Error404.page.html");
  }
});

app.use(errorLogger);

app.use(errorHandler);

export { app };
