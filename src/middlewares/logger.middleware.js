import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Separate streams for access and error logs
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});

const errorLogStream = fs.createWriteStream(path.join(logsDir, "error.log"), {
  flags: "a",
});

// Add timestamp token
morgan.token("timestamp", () => new Date().toISOString());

morgan.token("res-body", (req, res) => {
  return res.locals.body ? JSON.stringify(res.locals.body) : "-";
});

function captureResponseBody(req, res, next) {
  const oldJson = res.json;
  res.json = function (body) {
    if (body && typeof body === "object") {
      if (body.toJSON && typeof body.toJSON === "function") {
        res.locals.body = body.toJSON();
      } else {
        res.locals.body = body;
      }
    } else {
      res.locals.body = body;
    }
    return oldJson.call(this, body);
  };
  next();
}

morgan.token("status-code", (req, res) => {
  const body = res.locals.body;
  return body && body.statusCode ? body.statusCode : res.statusCode;
});

morgan.token("success", (req, res) => {
  const body = res.locals.body;
  return body && typeof body.success !== "undefined"
    ? body.success
    : res.statusCode < 400;
});

morgan.token("api-message", (req, res) => {
  const body = res.locals.body;
  return body && body.message ? body.message : "-";
});

morgan.token("status-text", (req, res) => {
  const body = res.locals.body;
  return body && body.statusText ? body.statusText : "-";
});

morgan.token("errors", (req, res) => {
  const body = res.locals.body;
  if (body && body.errors && body.errors.length > 0) {
    return JSON.stringify(body.errors);
  }
  return "-";
});

morgan.token("error-type", (req, res) => {
  const body = res.locals.body;
  return body && body.name ? body.name : "-";
});

morgan.token("request-id", (req) => {
  return req.id || "-";
});

const format = [
  "[:timestamp]",
  ":request-id",
  ":remote-addr",
  ":method :url",
  "status::status-code (:status-text)",
  ":success",
  ":response-time ms",
  "type::error-type",
  "message::api-message",
  "errors::errors",
  "req::req-body",
  "res::res-body",
].join(" | ");

morgan.token("req-body", (req) => JSON.stringify(req.body));

// Skip successful health check logs to reduce noise
const skipHealthCheck = (req, res) => {
  return req.url.includes("/healthCheck") && res.statusCode === 200;
};

export const requestLogger = morgan(format, {
  stream: accessLogStream,
  skip: skipHealthCheck,
});

// Development logger with console colors
export const requestLoggerDev = morgan(format, {
  skip: skipHealthCheck,
  // Add colors in development
  stream: {
    write: (message) => {
      const hasError =
        message.includes('"success":false') ||
        message.includes("status:4") ||
        message.includes("status:5");
      console.log(
        hasError ? "\x1b[31m%s\x1b[0m" : "\x1b[32m%s\x1b[0m",
        message
      );
    },
  },
});

// Error logger that only logs errors
export const errorLogger = morgan(format, {
  skip: (req, res) => res.statusCode < 400,
  stream: errorLogStream,
});

export { captureResponseBody };
