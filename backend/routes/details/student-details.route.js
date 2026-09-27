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
const {
  loginLimiter,
  resetRequestLimiter,
  resetSubmitLimiter,
} = require("../../middlewares/rateLimiter.middleware");

router.post("/register", uploadImage.single("file"), registerStudentController);
router.post("/login", loginLimiter, loginStudentController);
router.get("/my-details", auth, getMyDetailsController);

router.get("/", auth, getAllDetailsController);
router.patch("/:id", auth, uploadImage.single("file"), updateDetailsController);
router.delete("/:id", auth, deleteDetailsController);
router.post("/forget-password", resetRequestLimiter, sendForgetPasswordEmail);
router.post("/update-password/:resetId", resetSubmitLimiter, updatePasswordHandler);
router.post("/change-password", auth, updateLoggedInPasswordController);
router.post("/search", auth, searchStudentsController);

module.exports = router;
