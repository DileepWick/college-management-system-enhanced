const express = require("express");
const router = express.Router();
const {
  loginStudentController,
  getAllDetailsController,
  registerStudentController,
  updateDetailsController,
  deleteDetailsController,
  getMyDetailsController,
  sendForgetPasswordEmail,
  updatePasswordHandler,
  searchStudentsController,
  updateLoggedInPasswordController,
} = require("../../controllers/details/student-details.controller");
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
  registerStudentController
);

router.post("/register", uploadImage.single("file"), registerStudentController);
router.post("/login", loginLimiter, loginStudentController);
router.get("/my-details", auth, authorize("student"), getMyDetailsController);

router.get("/", auth, authorize("admin"), getAllDetailsController);
router.patch(
  "/:id",
  auth,
  authorize("admin"),
  upload.single("file"),
  updateDetailsController
);
router.delete("/:id", auth, authorize("admin"), deleteDetailsController);

router.get("/", auth, getAllDetailsController);
router.patch("/:id", auth, uploadImage.single("file"), updateDetailsController);
router.delete("/:id", auth, deleteDetailsController);
router.post("/forget-password", resetRequestLimiter, sendForgetPasswordEmail);
router.post("/update-password/:resetId", resetSubmitLimiter, updatePasswordHandler);
router.post(
  "/change-password",
  auth,
  authorize("student"),
  updateLoggedInPasswordController
);
router.post(
  "/search",
  auth,
  authorize("admin", "faculty"),
  searchStudentsController
);

module.exports = router;
