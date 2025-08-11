import NodeCache from "node-cache";

// Initialize cache with default TTL of 5 minutes and check period of 10 minutes
const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 600,
  useClones: false,
});

const getCacheKey = (req) => {
  return `${req.originalUrl || req.url}${JSON.stringify(req.query)}`;
};

export const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    // Skip caching for non-GET methods
    if (req.method !== "GET") {
      return next();
    }

    const key = getCacheKey(req);
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Store the original send and json methods
    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    // Override send
    res.send = function (body) {
      if (res.statusCode === 200) {
        cache.set(key, body, duration);
      }
      originalSend(body);
    };

    // Override json
    res.json = function (body) {
      if (res.statusCode === 200) {
        cache.set(key, body, duration);
      }
      originalJson(body);
    };

    next();
  };
};

// Cache durations
export const CACHE_DURATIONS = {
  VERY_SHORT: 60, // 1 minute
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400, // 24 hours
};

// Cache specific routes
export const cacheVideo = cacheMiddleware(CACHE_DURATIONS.MEDIUM);
export const cacheChannelStats = cacheMiddleware(CACHE_DURATIONS.SHORT);
export const cachePublicProfile = cacheMiddleware(CACHE_DURATIONS.MEDIUM);

// Cache cleanup methods
export const clearUserCache = (userId) => {
  const keys = cache.keys();
  const userRelatedKeys = keys.filter(
    (key) =>
      key.includes(`/users/${userId}`) || key.includes(`/channel/${userId}`)
  );
  cache.del(userRelatedKeys);
};

export const clearVideoCache = (videoId) => {
  const keys = cache.keys();
  const videoRelatedKeys = keys.filter((key) =>
    key.includes(`/videos/${videoId}`)
  );
  cache.del(videoRelatedKeys);
};

export default {
  cache,
  cacheMiddleware,
  CACHE_DURATIONS,
  clearUserCache,
  clearVideoCache,
  cacheVideo,
  cacheChannelStats,
  cachePublicProfile,
};
