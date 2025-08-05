import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import errorHandler from "./middlewares/errors.middleware.js";
import {
  captureResponseBody,
  errorLogger,
  requestLogger,
  requestLoggerDev,
} from "./middlewares/logger.middleware.js";
import healthCheckRouter from "./routes/healthCheck.routes.js";
import userRouter from "./routes/user.routes.js";

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

app.use("/api/v1/healthCheck", healthCheckRouter);
app.use("/api/v1/users", userRouter);

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
