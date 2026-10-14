const jwt = require("jsonwebtoken");
const ApiResponse = require("../utils/ApiResponse");
const { ROLE_MODELS } = require("../utils/roles");

const auth = async (req, res, next) => {
  try {
    let token = req.header("Authorization");

    if (!token || !token.startsWith("Bearer ")) {
      return ApiResponse.unauthorized("Authentication token required").send(
        res
      );
    }

    token = token.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error("JWT Error:", jwtError);
      return ApiResponse.unauthorized("Invalid or expired token").send(res);
    }

    const Model = ROLE_MODELS[decoded.role];
    if (!decoded.userId || !Model) {
      return ApiResponse.unauthorized("Invalid token format").send(res);
    }

    // The account must still exist in its role's collection and be active,
    // so deleted or deactivated users lose access before their token expires
    const user = await Model.findById(decoded.userId).select("status");
    if (!user || (user.status && user.status !== "active")) {
      return ApiResponse.unauthorized("Account not found or inactive").send(
        res
      );
    }

    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.token = token;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return ApiResponse.unauthorized("Authentication failed").send(res);
  }
};

module.exports = auth;
