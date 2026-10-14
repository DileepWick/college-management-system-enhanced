const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const ApiResponse = require("../utils/ApiResponse");
const { ROLE_MODELS } = require("../utils/roles");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleLoginController = async (req, res) => {
  try {
    const { credential, role } = req.body;

    const Model = ROLE_MODELS[role];
    if (!credential || !Model) {
      return ApiResponse.badRequest("Google credential and valid role are required").send(res);
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.error("Google Token Error: ", verifyError.message);
      return ApiResponse.unauthorized("Invalid Google credential").send(res);
    }

    if (!payload?.email || !payload.email_verified) {
      return ApiResponse.unauthorized("Google email is not verified").send(res);
    }

    const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN;
    if (allowedDomain && payload.hd !== allowedDomain) {
      return ApiResponse.forbidden("Email domain is not allowed").send(res);
    }

    // Accounts are created by admins only, so never auto-provision here
    const user = await Model.findOne({ email: payload.email }).collation({
      locale: "en",
      strength: 2,
    });
    if (!user) {
      return ApiResponse.unauthorized("No account linked to this Google email").send(res);
    }

    if (user.status && user.status !== "active") {
      return ApiResponse.forbidden("Account is inactive").send(res);
    }

    if (user.googleId && user.googleId !== payload.sub) {
      return ApiResponse.unauthorized("This account is linked to a different Google account").send(res);
    }

    if (!user.googleId) {
      // updateOne avoids the pre-save hook, which would re-hash the password
      await Model.updateOne({ _id: user._id }, { $set: { googleId: payload.sub } });
    }

    const token = jwt.sign({ userId: user._id, role }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return ApiResponse.success({ token }, "Login successful").send(res);
  } catch (error) {
    console.error("Google Login Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

module.exports = { googleLoginController };
