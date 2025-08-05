class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = "",
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.message = message;
    this.errors = Array.isArray(errors) ? errors : [errors];
    this.success = false;
    this.data = null;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }

    this.statusText = this.getStatusText(statusCode);
  }

  getStatusText(statusCode) {
    const statusTexts = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      409: "Conflict",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
      504: "Gateway Timeout",
    };
    return statusTexts[statusCode] || "Unknown Status";
  }

  toJSON() {
    return {
      success: this.success,
      statusCode: this.statusCode,
      statusText: this.statusText,
      message: this.message,
      errors: this.errors,
      data: this.data,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV === "development" && { stack: this.stack }),
    };
  }

  static badRequest(message = "Bad Request", errors = []) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message = "Unauthorized access") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Access forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message = "Resource conflict") {
    return new ApiError(409, message);
  }

  static validation(message = "Validation failed", validationErrors = []) {
    return new ApiError(422, message, validationErrors);
  }

  static internal(message = "Internal server error") {
    return new ApiError(500, message, [], "", false);
  }

  static tooManyRequests(message = "Too many requests") {
    return new ApiError(429, message);
  }
}

class ValidationError extends ApiError {
  constructor(message = "Validation failed", validationErrors = []) {
    super(422, message, validationErrors);
    this.name = "ValidationError";
  }

  static conflict(message = "Resource conflict", validationErrors = []) {
    const error = new ValidationError(message, validationErrors);
    error.statusCode = 409; 
    return error;
  }

  addError(field, message, value = undefined) {
    this.errors.push({
      field,
      message,
      ...(value !== undefined && { value }),
    });
  }
}

class DatabaseError extends ApiError {
  constructor(message = "Database operation failed", originalError = null) {
    super(500, message, [], "", false);
    this.name = "DatabaseError";
    this.originalError = originalError;

    if (originalError) {
      this.code = originalError.code;
      this.constraint = originalError.constraint;
    }
  }
}

class AuthenticationError extends ApiError {
  constructor(message = "Authentication failed") {
    super(401, message);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends ApiError {
  constructor(message = "Insufficient permissions") {
    super(403, message);
    this.name = "AuthorizationError";
  }
}

export {
  ApiError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ValidationError,
};

export default ApiError;