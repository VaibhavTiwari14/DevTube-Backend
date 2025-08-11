# User API Documentation

## Register User

**Endpoint:**

```
POST /api/v1/users/register
```

**Description:**
Register a new user with fullname, email, username, password, and optional avatar/cover image uploads.

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|------------|--------|----------|----------------------------------------------|
| fullname | string | Yes | Full name (2-50 chars, letters/spaces only) |
| email | string | Yes | Valid email address |
| username | string | Yes | 3-30 chars, letters/numbers/underscores |
| password | string | Yes | 8-128 chars, 1 uppercase, 1 lowercase, 1 num |
| avatar | file | No | JPEG/PNG/WebP/JPG, max 5MB |
| coverImage | file | No | JPEG/PNG/WebP/JPG, max 5MB |

**Response:**

- `201 Created`

```json
{
  "statusCode": 201,
  "success": true,
  "message": "User registered successfully.",
  "data": {
    "_id": "...",
    "fullname": "...",
    "email": "...",
    "username": "...",
    "avatar": "...",
    "coverImage": "..."
  },
  "timestamp": "..."
}
```

**Errors:**

- `400 Bad Request` (validation)
- `409 Conflict` (email/username exists)

---

## Login User

**Endpoint:**

```
POST /api/v1/users/login
```

**Description:**
Login with email and password. Sets accessToken and refreshToken cookies.

**Request Body (JSON):**

```json
{
  "email": "...",
  "password": "..."
}
```

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "User logged in successfully.",
  "data": {
    "user": { "_id": "...", "fullname": "...", ... },
    "accessToken": "...",
    "refreshToken": "..."
  },
  "timestamp": "..."
}
```

**Errors:**

- `401 Unauthorized` (invalid credentials)

---

## Refresh Tokens

**Endpoint:**

```
POST /api/v1/users/refreshTokens
```

**Description:**
Refresh access and refresh tokens using the refreshToken cookie or body.

**Request Body (JSON):**

```json
{
  "refreshToken": "..." // optional if cookie is set
}
```

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Access token refreshed successfully.",
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  },
  "timestamp": "..."
}
```

**Errors:**

- `401 Unauthorized` (invalid/expired token)

---

## Logout User

**Endpoint:**

```
POST /api/v1/users/logout
```

**Description:**
Logout the current user. Clears accessToken and refreshToken cookies.

**Headers:**

- `Authorization: Bearer <accessToken>`

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "User logged out successfully",
  "data": null,
  "timestamp": "..."
}
```

---

## Get Current User Profile

**Endpoint:**

```
GET /api/v1/users/profile
```

**Description:**
Get the profile of the currently authenticated user.

**Headers:**

- `Authorization: Bearer <accessToken>`

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Current user details",
  "data": {
    "_id": "...",
    "fullname": "...",
    "email": "...",
    "username": "...",
    "avatar": "...",
    "coverImage": "..."
  },
  "timestamp": "..."
}
```

---

## Get Channel Profile by Username

**Endpoint:**

```
GET /api/v1/users/channel/:username
```

**Description:**
Get public profile and stats for a channel by username.

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Channel profile fetched successfully",
  "data": {
    "_id": "...",
    "username": "...",
    "fullname": "...",
    "avatar": "...",
    "coverImage": "...",
    "subscriberCount": 123,
    "channelsSubscribedToCount": 5,
    "isSubscribed": true,
    "email": "..."
  },
  "timestamp": "..."
}
```

**Errors:**

- `404 Not Found` (channel not found)

---

## Get User Watch History

**Endpoint:**

```
GET /api/v1/users/watchHistory
```

**Description:**
Get the authenticated user's watch history (videos watched).

**Headers:**

- `Authorization: Bearer <accessToken>`

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Watch history fetched successfully",
  "data": [
    {
      "_id": "...",
      "title": "...",
      "owner": { "username": "...", "fullname": "...", "avatar": "..." }
      // ...other video fields
    }
  ],
  "timestamp": "..."
}
```

---

## Update Account Details

**Endpoint:**

```
PUT /api/v1/users/updateAccount
```

**Description:**
Update the authenticated user's fullname and/or email.

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body (JSON):**

```json
{
  "fullname": "...", // optional
  "email": "..." // optional
}
```

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "User details updated successfully.",
  "data": {
    "_id": "...",
    "fullname": "...",
    "email": "...",
    "username": "...",
    "avatar": "...",
    "coverImage": "..."
  },
  "timestamp": "..."
}
```

**Errors:**

- `400 Bad Request` (validation)
- `409 Conflict` (email exists)

---

## Change Password

**Endpoint:**

```
PUT /api/v1/users/changePassword
```

**Description:**
Change the authenticated user's password.

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body (JSON):**

```json
{
  "oldPassword": "...",
  "newPassword": "..."
}
```

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Password changed successfully",
  "data": null,
  "timestamp": "..."
}
```

**Errors:**

- `400 Bad Request` (validation)
- `401 Unauthorized` (old password incorrect)

---

## Update Avatar

**Endpoint:**

```
PUT /api/v1/users/updateAvatar
```

**Description:**
Update the authenticated user's avatar image.

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|--------|------|----------|----------------------------|
| avatar | file | Yes | JPEG/PNG/WebP/JPG, max 5MB |

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Avatar updated successfully.",
  "data": {
    "_id": "...",
    "avatar": "..."
    // ...other user fields
  },
  "timestamp": "..."
}
```

**Errors:**

- `400 Bad Request` (validation)

---

## Update Cover Image

**Endpoint:**

```
PUT /api/v1/users/updateCoverImage
```

**Description:**
Update the authenticated user's cover image.

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|------------|------|----------|----------------------------|
| coverImage | file | Yes | JPEG/PNG/WebP/JPG, max 5MB |

**Response:**

- `200 OK`

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Cover image updated successfully.",
  "data": {
    "_id": "...",
    "coverImage": "..."
    // ...other user fields
  },
  "timestamp": "..."
}
```

**Errors:**

- `400 Bad Request` (validation)

---

## Error Format

All error responses follow this format:

```json
{
  "success": false,
  "statusCode": 400,
  "statusText": "Bad Request",
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "Email already in use" }],
  "data": null,
  "timestamp": "..."
}
```

---

## Authentication

- All secure routes require the `Authorization: Bearer <accessToken>` header.
- Tokens are set as HTTP-only cookies on login/refresh.

---

# Video API Documentation

## Upload Video

**Endpoint:**

```
POST /api/v1/videos
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|-----------|--------|----------|----------------------------|
| title | string | Yes | Video title |
| description | string | Yes | Video description |
| videoFile | file | Yes | Video file (MP4/WebM) |
| thumbnail | file | Yes | Thumbnail image |
| duration | number | Yes | Video duration in seconds |

**Response:**

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Video published successfully",
  "data": {
    "video": {
      "_id": "...",
      "title": "...",
      "description": "...",
      "videoFile": "...",
      "thumbnail": "...",
      "duration": 120,
      "views": 0,
      "owner": "..."
    }
  }
}
```

## Get All Videos

**Endpoint:**

```
GET /api/v1/videos
```

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10, max: 50)
- `query` (search term)
- `sortBy` (createdAt/views/title/duration)
- `sortType` (asc/desc)
- `userId` (filter by channel)

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "videos": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalVideos": 48
    }
  }
}
```

## Get Video By ID

**Endpoint:**

```
GET /api/v1/videos/:id
```

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "_id": "...",
    "title": "...",
    "description": "...",
    "videoFile": "...",
    "thumbnail": "...",
    "duration": 120,
    "views": 100,
    "owner": {
      "_id": "...",
      "username": "...",
      "avatar": "..."
    }
  }
}
```

# Dashboard API Documentation

## Get Channel Stats

**Endpoint:**

```
GET /api/v1/dashboard/stats
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "videoStats": {
      "total": 50,
      "published": 45,
      "unpublished": 5,
      "totalViews": 10000,
      "averageDuration": 300
    },
    "subscriberCount": 1000,
    "totalLikes": 5000,
    "engagementRate": 4.5
  }
}
```

## Get Channel Videos

**Endpoint:**

```
GET /api/v1/dashboard/videos
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `sortBy` (createdAt/views)
- `order` (asc/desc)
- `isPublished` (boolean)

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "videos": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalVideos": 50,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

# Subscription API Documentation

## Toggle Subscription

**Endpoint:**

```
POST /api/v1/subscriptions/toggle/:channelId
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Successfully subscribed/unsubscribed to channel",
  "data": {
    "action": "subscribed/unsubscribed"
  }
}
```

## Get Channel Subscribers

**Endpoint:**

```
GET /api/v1/subscriptions/subscribers/:channelId
```

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": [
    {
      "_id": "...",
      "subscriber": {
        "_id": "...",
        "username": "...",
        "avatar": "..."
      }
    }
  ]
}
```

# Playlist API Documentation

## Create Playlist

**Endpoint:**

```
POST /api/v1/playlists
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "name": "...",
  "description": "...",
  "isPrivate": false
}
```

**Response:**

```json
{
  "statusCode": 201,
  "success": true,
  "data": {
    "_id": "...",
    "name": "...",
    "description": "...",
    "videos": [],
    "owner": "..."
  }
}
```

# Like API Documentation

## Toggle Like

**Endpoint:**

```
POST /api/v1/likes/toggle
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "videoId": "...",
  "type": "Video/Comment"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true/false
  }
}
```

## Get Liked Videos

**Endpoint:**

```
GET /api/v1/likes/videos
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "videos": [...]
  }
}
```

# Comment API Documentation

## Add Comment

**Endpoint:**

```
POST /api/v1/comments
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "content": "...",
  "videoId": "...",
  "parentCommentId": "..." // Optional, for replies
}
```

**Response:**

```json
{
  "statusCode": 201,
  "success": true,
  "data": {
    "_id": "...",
    "content": "...",
    "video": "...",
    "owner": {
      "_id": "...",
      "username": "...",
      "avatar": "..."
    },
    "parentComment": "...",
    "createdAt": "..."
  }
}
```

## Get Video Comments

**Endpoint:**

```
GET /api/v1/comments/video/:videoId
```

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)
- `sortBy` (newest/oldest/popular)

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "comments": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalComments": 48
    }
  }
}
```

## Update Comment

**Endpoint:**

```
PATCH /api/v1/comments/:commentId
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "content": "..."
}
```

## Delete Comment

**Endpoint:**

```
DELETE /api/v1/comments/:commentId
```

**Headers:**

- `Authorization: Bearer <accessToken>`

# Tweet API Documentation

## Create Tweet

**Endpoint:**

```
POST /api/v1/tweets
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "content": "..."
}
```

## Get User Tweets

**Endpoint:**

```
GET /api/v1/tweets/user/:userId
```

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 10)

## Update Tweet

**Endpoint:**

```
PATCH /api/v1/tweets/:tweetId
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body:**

```json
{
  "content": "..."
}
```

## Delete Tweet

**Endpoint:**

```
DELETE /api/v1/tweets/:tweetId
```

# Playlist API Documentation (Additional Endpoints)

## Get User Playlists

**Endpoint:**

```
GET /api/v1/playlists/user/:userId
```

## Add Video to Playlist

**Endpoint:**

```
POST /api/v1/playlists/:playlistId/videos
```

**Request Body:**

```json
{
  "videoId": "..."
}
```

## Remove Video from Playlist

**Endpoint:**

```
DELETE /api/v1/playlists/:playlistId/videos/:videoId
```

## Delete Playlist

**Endpoint:**

```
DELETE /api/v1/playlists/:playlistId
```

# Video API Documentation (Additional Endpoints)

## Update Video

**Endpoint:**

```
PATCH /api/v1/videos/:videoId
```

**Headers:**

- `Authorization: Bearer <accessToken>`

**Request Body (multipart/form-data):**
| Field | Type | Required | Description |
|-----------|--------|----------|----------------------------|
| title | string | No | New video title |
| description | string | No | New description |
| thumbnail | file | No | New thumbnail image |

## Delete Video

**Endpoint:**

```
DELETE /api/v1/videos/:videoId
```

## Toggle Video Publish Status

**Endpoint:**

```
PATCH /api/v1/videos/:videoId/toggle-publish
```

# Dashboard API Documentation (Additional Endpoints)

## Get Video Analytics

**Endpoint:**

```
GET /api/v1/dashboard/videos/:videoId/analytics
```

**Query Parameters:**

- `startDate` (ISO date)
- `endDate` (ISO date)
- `metric` (views/likes/comments)

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "data": {
    "metrics": {
      "views": 1000,
      "likes": 50,
      "comments": 25
    },
    "timeline": [
      {
        "date": "2025-08-01",
        "value": 100
      }
    ]
  }
}
```

# Rate Limits

- Authentication routes: 5 attempts per hour
- API routes: 100 requests per 15 minutes
- Video uploads: 10 uploads per hour

# Caching

- Video listings: 5 minutes
- Channel statistics: 5 minutes
- Public profiles: 30 minutes

# Frontend Notes

- For file uploads, use `multipart/form-data` encoding
- All timestamps are ISO8601 strings
- All responses include a `success` boolean, `statusCode`, `message`, and `data`
- Errors include a list of field-level issues if validation fails
- File size limits:
  - Video: 100MB
  - Images: 5MB
  - Request body: 16kb
- Support for WebP, JPEG, PNG image formats
- Video formats: MP4, WebM
- Authentication uses HTTP-only cookies for tokens
- CORS enabled for localhost:3000 in development
