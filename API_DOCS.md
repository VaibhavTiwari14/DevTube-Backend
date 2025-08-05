# Health Check API

## Endpoint

```
GET /api/v1/healthCheck
```

## Description

Checks if the API service is running and healthy.

## Response

- **Status:** `200 OK`
- **Content-Type:** `application/json`
- **Body Example:**
  ```json
  {
    "statusCode": 200,
    "success": true,
    "message": "Health check passed",
    "data": {},
    "timestamp": "2024-06-01T12:00:00.000Z"
  }
  ```

## Errors

- **Status:** `500 Internal Server Error`
  - Indicates the service is not healthy or an unexpected error occurred.
  - **Body Example:**
    ```json
    {
      "success": false,
      "statusCode": 500,
      "statusText": "Internal Server Error",
      "message": "Internal server error",
      "errors": [],
      "data": null,
      "timestamp": "2024-06-01T12:00:00.000Z"
    }
    ```
