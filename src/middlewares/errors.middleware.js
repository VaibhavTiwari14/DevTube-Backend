import ApiError from "../utils/ApiError.js";

const errorHandler = (err, req, res, _) => {
  let error = err;

  if (!(error instanceof Error)) {
    error = new ApiError(500, "Something went wrong", [], "", false);
  }

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    error = new ApiError(
      statusCode,
      error.message || "Internal Server Error",
      [],
      error.stack,
      false
    );
  }

  const errorResponse = error.toJSON();

  if (process.env.NODE_ENV !== "production") {
    console.error("🚨 Global Error:", {
      path: req.path,
      method: req.method,
      ...errorResponse,
    });
  }

  res.status(error.statusCode || 500).json(errorResponse);
};

export default errorHandler;  