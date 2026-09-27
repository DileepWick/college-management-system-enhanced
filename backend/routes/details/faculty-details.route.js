const express = require("express");
const router = express.Router();
const {
  loginFacultyController,
  registerFacultyController,
  updateFacultyController,
  deleteFacultyController,
  getAllFacultyController,
  getMyFacultyDetailsController,
  sendFacultyResetPasswordEmail,
  updateFacultyPasswordHandler,
  updateLoggedInPasswordController,
} = require("../../controllers/details/faculty-details.controller");
const { uploadImage } = require("../../middlewares/multer.middleware");
const auth = require("../../middlewares/auth.middleware");
const authorize = require("../../middlewares/authorize.middleware");
const {
  loginLimiter,
  resetRequestLimiter,
  resetSubmitLimiter,
} = require("../../middlewares/rateLimiter.middleware");

router.post(
  "/register",
  auth,
  authorize("admin"),
  upload.single("file"),
  registerFacultyController
);

router.post("/register", uploadImage.single("file"), registerFacultyController);
router.post("/login", loginLimiter, loginFacultyController);
router.get(
  "/my-details",
  auth,
  authorize("faculty"),
  getMyFacultyDetailsController
);

router.get("/", auth, authorize("admin"), getAllFacultyController);
router.patch(
  "/:id",
  auth,
  authorize("admin"),
  upload.single("file"),
  updateFacultyController
);
router.delete("/:id", auth, authorize("admin"), deleteFacultyController);

router.get("/", auth, getAllFacultyController);
router.patch("/:id", auth, uploadImage.single("file"), updateFacultyController);
router.delete("/:id", auth, deleteFacultyController);
router.post("/forget-password", resetRequestLimiter, sendFacultyResetPasswordEmail);
router.post("/update-password/:resetId", resetSubmitLimiter, updateFacultyPasswordHandler);
router.post(
  "/change-password",
  auth,
  authorize("faculty"),
  updateLoggedInPasswordController
);

module.exports = router;
