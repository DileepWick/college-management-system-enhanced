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
const upload = require("../../middlewares/multer.middleware");
const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const {
  loginLimiter,
  resetRequestLimiter,
  resetSubmitLimiter,
} = require("../../middlewares/rateLimiter.middleware");

router.post("/register", upload.single("file"), registerAdminController);
router.post("/login", loginLimiter, loginAdminController);
router.get("/my-details", auth, authorize("admin"), getMyDetailsController);

router.get("/", auth, authorize("admin"), getAllDetailsController);
router.patch(
  "/:id",
  auth,
  authorize("admin"),
  upload.single("file"),
  updateDetailsController
);
router.delete("/:id", auth, authorize("admin"), deleteDetailsController);
router.post("/forget-password", resetRequestLimiter, sendForgetPasswordEmail);
router.post("/update-password/:resetId", resetSubmitLimiter, updatePasswordHandler);
router.post(
  "/change-password",
  auth,
  authorize("admin"),
  updateLoggedInPasswordController
);

module.exports = router;
