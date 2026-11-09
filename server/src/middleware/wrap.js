/** Lets async route handlers throw: errors are forwarded to Express' error handler. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
