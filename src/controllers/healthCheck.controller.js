import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const healthCheck = asyncHandler(async (req, res) => {
  return ApiResponse.sendResponse(
    res,
    ApiResponse.ok({}, "Health check passed")
  );
});

export { healthCheck };
