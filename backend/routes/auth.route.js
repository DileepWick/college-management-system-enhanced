const express = require("express");
const router = express.Router();
const { googleLoginController } = require("../controllers/auth.controller");

router.post("/google", googleLoginController);

module.exports = router;
