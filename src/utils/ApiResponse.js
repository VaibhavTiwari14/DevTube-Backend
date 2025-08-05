class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      success: this.success,
      message: this.message,
      data: this.data,
      timestamp: this.timestamp,
    };
  }

  static ok(data, message = "Success") {
    return new ApiResponse(200, data, message);
  }

  static created(data, message = "Resource created successfully") {
    return new ApiResponse(201, data, message);
  }

  static accepted(data, message = "Request accepted") {
    return new ApiResponse(202, data, message);
  }

  static noContent(message = "No content") {
    return new ApiResponse(204, null, message);
  }

  static paginated(data, pagination, message = "Success") {
    return new ApiResponse(
      200,
      {
        items: data,
        pagination: {
          page: pagination.page || 1,
          limit: pagination.limit || 10,
          total: pagination.total || 0,
          totalPages: Math.ceil(
            (pagination.total || 0) / (pagination.limit || 10)
          ),
          hasNext:
            pagination.page <
            Math.ceil((pagination.total || 0) / (pagination.limit || 10)),
          hasPrev: pagination.page > 1,
        },
      },
      message
    );
  }

  static list(data, message = "List retrieved successfully") {
    return new ApiResponse(
      200,
      {
        items: data,
        count: Array.isArray(data) ? data.length : 0,
      },
      message
    );
  }

  static sendResponse(res, apiResponse) {
    return res.status(apiResponse.statusCode).json(apiResponse.toJSON());
  }
}

class SuccessResponse extends ApiResponse {
  constructor(data, message = "Operation successful") {
    super(200, data, message);
  }
}

class CreatedResponse extends ApiResponse {
  constructor(data, message = "Resource created successfully") {
    super(201, data, message);
  }
}

class NoContentResponse extends ApiResponse {
  constructor(message = "Operation completed successfully") {
    super(204, null, message);
  }
}

export { ApiResponse, CreatedResponse, NoContentResponse, SuccessResponse };

export default ApiResponse;
 