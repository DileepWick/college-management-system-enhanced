const express = require("express");
const router = express.Router();
const {
  getAllDetailsController,
  registerAdminController,
  updateDetailsController,
  deleteDetailsController,
  loginAdminController,
  getMyDetailsController,
  sendForgetPasswordEmail,
  updatePasswordHandler,
  updateLoggedInPasswordController,
} = require("../../controllers/details/admin-details.controller");
const { uploadImage } = require("../../middlewares/multer.middleware");
const auth = require("../../middlewares/auth.middleware");
const {
  loginLimiter,
  resetRequestLimiter,
  resetSubmitLimiter,
} = require("../../middlewares/rateLimiter.middleware");

router.post("/register", uploadImage.single("file"), registerAdminController);
router.post("/login", loginLimiter, loginAdminController);
router.get("/my-details", auth, getMyDetailsController);

router.get("/", auth, getAllDetailsController);
router.patch("/:id", auth, uploadImage.single("file"), updateDetailsController);
router.delete("/:id", auth, deleteDetailsController);
router.post("/forget-password", resetRequestLimiter, sendForgetPasswordEmail);
router.post("/update-password/:resetId", resetSubmitLimiter, updatePasswordHandler);
router.post("/change-password", auth, updateLoggedInPasswordController);

module.exports = router;
