# DevTube

DevTube is a backend project designed to power a video-sharing platform for developers. It provides APIs for user management, video uploads, comments, and more.

## Features

- User authentication and authorization
- Video upload and streaming
- Commenting system
- Like/dislike functionality
- RESTful API design

## Tech Stack

- **Node.js**
- **Express.js**
- **MongoDB** (Mongoose)
- **JWT** for authentication

## UTILS

# AsyncHandler - Express.js Async Error Wrapper

A utility function that wraps Express.js async route handlers to automatically catch errors and forward them to Express error middleware.

## The Problem

Express.js doesn't automatically catch errors from async route handlers, which can crash your application.

```javascript
// ❌ Dangerous - unhandled errors can crash the app
app.get('/users', async (req, res) => {
  const users = await User.find(); // If this throws, app crashes
  res.json(users);
});

// ✅ Safe - errors are automatically handled
app.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find(); // Errors forwarded to error middleware
  res.json(users);
}));
```

## Features

- 🛡️ **Automatic Error Catching** - Catches async errors and promise rejections
- 🔍 **Enhanced Error Context** - Adds request path, method, timestamp, and request ID
- 🚀 **Zero Configuration** - Drop-in wrapper for async functions
- 📝 **Type Safety** - Validates function input

## Quick Start

```javascript
import asyncHandler from './asyncHandler.js';

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  return ApiResponse.sendResponse(res, ApiResponse.ok(user));
}));
```

## Enhanced Error Context

AsyncHandler automatically adds these properties to errors:

```javascript
{
  path: "/users/123",      // Request path
  method: "GET",           // HTTP method  
  timestamp: "2024-01-15T10:30:00.000Z", // When error occurred
  requestId: "uuid-123"    // Request ID (if available)
}
```

## Express Error Middleware

```javascript
app.use((error, req, res, next) => {
  console.error('Error:', {
    message: error.message,
    path: error.path,
    method: error.method,
    requestId: error.requestId
  });
  
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json(error.toJSON());
  }
  
  const apiError = ApiError.internal("Something went wrong");
  res.status(500).json(apiError.toJSON());
});
```

## Usage Examples

```javascript
// CRUD operations
app.get('/users', asyncHandler(async (req, res) => {
  const users = await User.findAll();
  return ApiResponse.sendResponse(res, ApiResponse.list(users));
}));

app.post('/users', asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  return ApiResponse.sendResponse(res, ApiResponse.created(user));
}));

// Complex operations
app.post('/orders', asyncHandler(async (req, res) => {
  const transaction = await db.beginTransaction();
  try {
    const order = await Order.create(req.body, { transaction });
    await updateInventory(order.items, { transaction });
    await transaction.commit();
    return ApiResponse.sendResponse(res, ApiResponse.created(order));
  } catch (error) {
    await transaction.rollback();
    throw error; // AsyncHandler catches this
  }
}));
```

## Request ID Integration

```javascript
// Add request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || generateId();
  next();
});

// AsyncHandler automatically includes req.id in errors
```

## Benefits

- **Prevents App Crashes** - No more unhandled promise rejections
- **Better Debugging** - Rich error context for troubleshooting  
- **Clean Code** - No try/catch blocks needed in route handlers
- **Consistent Errors** - All async errors flow through error middleware

# ApiError - Custom Error Handling for Express.js APIs

A comprehensive error handling solution for Express.js applications that provides consistent error responses and better debugging capabilities.

## Features

- 🎯 **Consistent Error Format** - Standardized error responses across your API
- 🚀 **Static Factory Methods** - Easy-to-use methods for common HTTP errors
- 🛠️ **Specialized Error Classes** - Specific error types for different scenarios
- 🔍 **Enhanced Debugging** - Rich error context with timestamps and stack traces
- 🌍 **Environment Aware** - Stack traces only in development mode
- 📊 **JSON Serialization** - Clean API responses with `toJSON()` method

## Installation

```bash
# Copy the ApiError classes to your project
# No external dependencies required
```

## Quick Start

### Basic Usage

```javascript
import ApiError from './path/to/ApiError.js';

// Throw errors using static methods
throw ApiError.badRequest("Invalid email format");
throw ApiError.notFound("User not found");
throw ApiError.unauthorized("Invalid credentials");

// Or use the constructor directly
throw new ApiError(400, "Custom error message", ['validation error']);
```

### Express Error Middleware

```javascript
app.use((error, req, res, next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json(error.toJSON());
  }
  
  // Handle unexpected errors
  const apiError = ApiError.internal("Something went wrong");
  res.status(500).json(apiError.toJSON());
});
```

## API Reference

### ApiError Class

#### Constructor
```javascript
new ApiError(statusCode, message, errors, stack, isOperational)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| statusCode | number | - | HTTP status code |
| message | string | "Something went wrong" | Error message |
| errors | Array\|string | [] | Additional error details |
| stack | string | "" | Custom stack trace |
| isOperational | boolean | true | Whether this is an operational error |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| statusCode | number | HTTP status code |
| statusText | string | HTTP status text |
| message | string | Error message |
| errors | Array | Additional error details |
| success | boolean | Always false |
| data | null | Always null |
| timestamp | string | ISO timestamp when error was created |
| isOperational | boolean | Whether error is operational |

#### Methods

**toJSON()** - Returns a clean object for JSON responses

### Static Factory Methods

```javascript
// 400 Bad Request
ApiError.badRequest(message?, errors?)

// 401 Unauthorized
ApiError.unauthorized(message?)

// 403 Forbidden
ApiError.forbidden(message?)

// 404 Not Found
ApiError.notFound(message?)

// 409 Conflict
ApiError.conflict(message?)

// 422 Unprocessable Entity
ApiError.validation(message?, validationErrors?)

// 429 Too Many Requests
ApiError.tooManyRequests(message?)

// 500 Internal Server Error
ApiError.internal(message?)
```

## Specialized Error Classes

### ValidationError

For handling validation errors with field-specific details.

```javascript
import { ValidationError } from './path/to/ApiError.js';

const validationError = new ValidationError();
validationError.addError('email', 'Email is required');
validationError.addError('password', 'Password must be at least 8 characters');
throw validationError;
```

### DatabaseError

For database-related errors with additional context.

```javascript
import { DatabaseError } from './path/to/ApiError.js';

try {
  await db.query('SELECT * FROM users');
} catch (dbError) {
  throw new DatabaseError("Failed to fetch users", dbError);
}
```

### AuthenticationError

For authentication failures.

```javascript
import { AuthenticationError } from './path/to/ApiError.js';

if (!validCredentials) {
  throw new AuthenticationError("Invalid username or password");
}
```

### AuthorizationError

For authorization/permission errors.

```javascript
import { AuthorizationError } from './path/to/ApiError.js';

if (!user.hasPermission('admin')) {
  throw new AuthorizationError("Admin access required");
}
```

## Usage Examples

### Route Handler with Validation

```javascript
import { asyncHandler } from './asyncHandler.js';
import { ValidationError } from './ApiError.js';

app.post('/users', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  const validation = new ValidationError();
  
  if (!email) validation.addError('email', 'Email is required');
  if (!password) validation.addError('password', 'Password is required');
  if (password && password.length < 8) {
    validation.addError('password', 'Password must be at least 8 characters');
  }
  
  if (validation.errors.length > 0) throw validation;
  
  const user = await User.create({ email, password });
  res.status(201).json({ success: true, data: user });
}));
```

### Error Response Format

All errors return a consistent JSON structure:

```json
{
  "success": false,
  "statusCode": 400,
  "statusText": "Bad Request",
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ],
  "data": null,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "stack": "Error stack trace (development only)"
}
```

## Best Practices

1. **Use Static Methods** - Prefer `ApiError.badRequest()` over `new ApiError(400, ...)`
2. **Operational vs Programming Errors** - Set `isOperational: false` for programming errors
3. **Error Context** - Include relevant details in the `errors` array
4. **Consistent Messages** - Use clear, user-friendly error messages
5. **Security** - Don't expose sensitive information in error messages

## Environment Configuration

Stack traces are automatically included only in development mode:

```javascript
// Set NODE_ENV for production
process.env.NODE_ENV = 'production'; // No stack traces
process.env.NODE_ENV = 'development'; // Include stack traces
```

## Integration with Async Handler

Works seamlessly with async error handlers:

```javascript
import { asyncHandler } from './asyncHandler.js';
import ApiError from './ApiError.js';

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  
  res.json({ success: true, data: user });
}));
```

## TypeScript Support

For TypeScript projects, add type definitions:

```typescript
interface ErrorDetail {
  field: string;
  message: string;
  value?: any;
}

class ApiError extends Error {
  statusCode: number;
  statusText: string;
  errors: ErrorDetail[];
  success: false;
  data: null;
  timestamp: string;
  isOperational: boolean;
  
  // ... rest of the implementation
}
```

## Contributing

Feel free to extend the error classes for your specific use cases:

```javascript
class PaymentError extends ApiError {
  constructor(message = "Payment failed", paymentDetails = {}) {
    super(402, message); // 402 Payment Required
    this.name = "PaymentError";
    this.paymentDetails = paymentDetails;
  }
}
```

## License

MIT License - Feel free to use in your projects!

# ApiResponse - Standardized Success Responses for Express.js APIs

A comprehensive solution for creating consistent, well-structured success responses in Express.js applications. Perfect companion to the ApiError class for complete API response standardization.

## Features

- 🎯 **Consistent Response Format** - Standardized success responses across your API
- 🚀 **Static Factory Methods** - Easy-to-use methods for common HTTP success responses
- 📊 **Pagination Support** - Built-in pagination with metadata
- 📋 **List Responses** - Specialized responses for array data with count
- 🕐 **Timestamps** - Automatic timestamp generation
- 🛠️ **Specialized Classes** - Pre-configured response classes for common scenarios
- 📤 **Response Helper** - Utility method to send responses directly

## Installation

```bash
# Copy the ApiResponse classes to your project
# No external dependencies required
```

## Quick Start

### Basic Usage

```javascript
import ApiResponse from './path/to/ApiResponse.js';

// Using static methods (recommended)
const response = ApiResponse.ok(userData, "User retrieved successfully");
return res.status(response.statusCode).json(response.toJSON());

// Or use the convenience helper
return ApiResponse.sendResponse(res, ApiResponse.ok(userData));

// Constructor usage
const response = new ApiResponse(200, userData, "Success");
return res.status(response.statusCode).json(response.toJSON());
```

### Express Route Examples

```javascript
import { asyncHandler } from './asyncHandler.js';
import ApiResponse from './ApiResponse.js';

// Simple success response
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  return ApiResponse.sendResponse(res, ApiResponse.ok(user, "User found"));
}));

// Created response
app.post('/users', asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  return ApiResponse.sendResponse(res, ApiResponse.created(user));
}));
```

## API Reference

### ApiResponse Class

#### Constructor
```javascript
new ApiResponse(statusCode, data, message)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| statusCode | number | - | HTTP status code |
| data | any | - | Response data |
| message | string | "Success" | Success message |

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| statusCode | number | HTTP status code |
| data | any | Response data |
| message | string | Success message |
| success | boolean | True if statusCode < 400 |
| timestamp | string | ISO timestamp when response was created |

#### Methods

**toJSON()** - Returns a clean object for JSON responses

**static sendResponse(res, apiResponse)** - Helper to send response directly

### Static Factory Methods

```javascript
// 200 OK
ApiResponse.ok(data, message?)

// 201 Created
ApiResponse.created(data, message?)

// 202 Accepted
ApiResponse.accepted(data, message?)

// 204 No Content
ApiResponse.noContent(message?)

// 200 OK with pagination
ApiResponse.paginated(data, pagination, message?)

// 200 OK with list metadata
ApiResponse.list(data, message?)
```

## Specialized Response Classes

### SuccessResponse

General success response (200 OK).

```javascript
import { SuccessResponse } from './path/to/ApiResponse.js';

const response = new SuccessResponse(userData, "User retrieved");
return ApiResponse.sendResponse(res, response);
```

### CreatedResponse

For resource creation (201 Created).

```javascript
import { CreatedResponse } from './path/to/ApiResponse.js';

const response = new CreatedResponse(newUser, "User created successfully");
return ApiResponse.sendResponse(res, response);
```

### NoContentResponse

For successful operations with no content (204 No Content).

```javascript
import { NoContentResponse } from './path/to/ApiResponse.js';

const response = new NoContentResponse("User deleted successfully");
return ApiResponse.sendResponse(res, response);
```

## Response Formats

### Standard Response

```json
{
  "statusCode": 200,
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Paginated Response

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "items": [
      { "id": 1, "name": "User 1" },
      { "id": 2, "name": "User 2" }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### List Response

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Products retrieved successfully",
  "data": {
    "items": [
      { "id": 1, "name": "Product 1" },
      { "id": 2, "name": "Product 2" }
    ],
    "count": 2
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Usage Examples

### CRUD Operations

```javascript
import ApiResponse from './ApiResponse.js';
import { asyncHandler } from './asyncHandler.js';

// GET /users - List all users
app.get('/users', asyncHandler(async (req, res) => {
  const users = await User.findAll();
  return ApiResponse.sendResponse(
    res, 
    ApiResponse.list(users, "Users retrieved successfully")
  );
}));

// GET /users/:id - Get single user
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  return ApiResponse.sendResponse(
    res, 
    ApiResponse.ok(user, "User found")
  );
}));

// POST /users - Create user
app.post('/users', asyncHandler(async (req, res) => {
  const user = await User.create(req.body);
  return ApiResponse.sendResponse(
    res, 
    ApiResponse.created(user, "User created successfully")
  );
}));

// PUT /users/:id - Update user
app.put('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.update(req.params.id, req.body);
  return ApiResponse.sendResponse(
    res, 
    ApiResponse.ok(user, "User updated successfully")
  );
}));

// DELETE /users/:id - Delete user
app.delete('/users/:id', asyncHandler(async (req, res) => {
  await User.delete(req.params.id);
  return ApiResponse.sendResponse(
    res, 
    ApiResponse.noContent("User deleted successfully")
  );
}));
```

### Pagination Example

```javascript
app.get('/users', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  
  const { users, total } = await User.findWithPagination(page, limit);
  
  return ApiResponse.sendResponse(
    res,
    ApiResponse.paginated(
      users,
      { page, limit, total },
      "Users retrieved successfully"
    )
  );
}));
```

### Search and Filter

```javascript
app.get('/users/search', asyncHandler(async (req, res) => {
  const { query } = req.query;
  const users = await User.search(query);
  
  return ApiResponse.sendResponse(
    res,
    ApiResponse.list(users, `Found ${users.length} users matching "${query}"`)
  );
}));
```

### File Upload Response

```javascript
app.post('/upload', asyncHandler(async (req, res) => {
  const file = await FileService.upload(req.file);
  
  return ApiResponse.sendResponse(
    res,
    ApiResponse.created(
      { 
        filename: file.filename,
        url: file.url,
        size: file.size 
      },
      "File uploaded successfully"
    )
  );
}));
```

## Best Practices

1. **Use Static Methods** - Prefer `ApiResponse.ok()` over `new ApiResponse(200, ...)`
2. **Meaningful Messages** - Provide clear, descriptive success messages
3. **Consistent Data Structure** - Keep your data structure consistent across endpoints
4. **Use Specialized Classes** - Use `CreatedResponse`, `SuccessResponse` for semantic clarity
5. **Helper Method** - Use `sendResponse()` to reduce boilerplate code

## Integration with ApiError

Perfect companion to ApiError for complete API response standardization:

```javascript
import ApiResponse from './ApiResponse.js';
import ApiError from './ApiError.js';
import { asyncHandler } from './asyncHandler.js';

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  
  return ApiResponse.sendResponse(
    res, 
    ApiResponse.ok(user, "User retrieved successfully")
  );
}));

// Error middleware handles ApiError instances
app.use((error, req, res, next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json(error.toJSON());
  }
  
  const apiError = ApiError.internal("Something went wrong");
  res.status(500).json(apiError.toJSON());
});
```

## Advanced Usage

### Custom Response Types

Extend ApiResponse for domain-specific responses:

```javascript
class AuthResponse extends ApiResponse {
  constructor(user, token, message = "Authentication successful") {
    super(200, { user, token }, message);
    this.name = "AuthResponse";
  }
}

// Usage
const authResponse = new AuthResponse(user, jwtToken);
return ApiResponse.sendResponse(res, authResponse);
```

### Response Middleware

Create middleware for common response patterns:

```javascript
const responseMiddleware = (req, res, next) => {
  res.apiSuccess = (data, message) => {
    return ApiResponse.sendResponse(res, ApiResponse.ok(data, message));
  };
  
  res.apiCreated = (data, message) => {
    return ApiResponse.sendResponse(res, ApiResponse.created(data, message));
  };
  
  next();
};

app.use(responseMiddleware);

// Usage in routes
app.get('/users', asyncHandler(async (req, res) => {
  const users = await User.findAll();
  return res.apiSuccess(users, "Users retrieved");
}));
```

## TypeScript Support

For TypeScript projects, add type definitions:

```typescript
interface PaginationOptions {
  page: number;
  limit: number;
  total: number;
}

class ApiResponse<T = any> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
  timestamp: string;
  
  constructor(statusCode: number, data: T, message?: string);
  toJSON(): object;
  static ok<T>(data: T, message?: string): ApiResponse<T>;
  // ... other methods
}
```

## Testing

Example test cases:

```javascript
import ApiResponse from './ApiResponse.js';

describe('ApiResponse', () => {
  test('should create success response', () => {
    const response = ApiResponse.ok({ id: 1 }, "Test success");
    
    expect(response.statusCode).toBe(200);
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ id: 1 });
    expect(response.message).toBe("Test success");
    expect(response.timestamp).toBeDefined();
  });
  
  test('should create paginated response', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const pagination = { page: 1, limit: 10, total: 20 };
    const response = ApiResponse.paginated(data, pagination);
    
    expect(response.data.items).toEqual(data);
    expect(response.data.pagination.totalPages).toBe(2);
    expect(response.data.pagination.hasNext).toBe(true);
  });
});
```

## Contributing

Feel free to extend the response classes for your specific use cases and contribute improvements!

## License

MIT License - Feel free to use in your projects!



# API Documentation

See [API_DOCS.md](./API_DOCS.md) for detailed API endpoints and usage.

## Contributing

Contributions are welcome! Please open issues and submit pull requests.

## License

This project is licensed under the MIT License.