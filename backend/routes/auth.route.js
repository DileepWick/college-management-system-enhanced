const express = require("express");
const router = express.Router();
const { googleLoginController } = require("../controllers/auth.controller");
const { loginLimiter } = require("../middlewares/rateLimiter.middleware");

router.post("/google", loginLimiter, googleLoginController);

module.exports = router;
