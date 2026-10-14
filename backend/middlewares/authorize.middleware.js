const ApiResponse = require("../utils/ApiResponse");

// Runs after auth: only lets the request through if the caller's role is allowed
const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return ApiResponse.forbidden(
        "You do not have permission to perform this action"
      ).send(res);
    }
    next();
  };

module.exports = authorize;
