/**
 * Handle 404 Not Found errors
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Handle all other errors globally
 */
export const errorHandler = (err, req, res, next) => {
  // Sometimes error status is 200 even when there's an error, force 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    message: err.message,
    // Provide stack trace only in development
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};
