const asyncHandler = (requestHandler) => {
  if (typeof requestHandler !== "function") {
    throw new TypeError("AsyncHandler expects a function as argument");
  }

  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((error) => {
      if (error && typeof error === "object") {
        error.path = req.path;
        error.method = req.method;
        error.timestamp = new Date().toISOString();
        if (req.id) {
          error.requestId = req.id;
        }
      }
      next(error);
    });
  };
};

export default asyncHandler;
