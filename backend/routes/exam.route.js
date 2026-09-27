const express = require("express");
const {
  getAllExamsController,
  addExamController,
  updateExamController,
  deleteExamController,
} = require("../controllers/exam.controller");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
const router = express.Router();
const { uploadSchedule } = require("../middlewares/multer.middleware");

router.get("/", auth, getAllExamsController);
router.post(
  "/",
  auth,
  authorize("admin", "faculty"),
  upload.single("file"),
  addExamController
);
router.patch(
  "/:id",
  auth,
  authorize("admin", "faculty"),
  upload.single("file"),
  updateExamController
);
router.delete("/:id", auth, authorize("admin", "faculty"), deleteExamController);

router.post("/", auth, uploadSchedule.single("file"), addExamController);
router.patch("/:id", auth, uploadSchedule.single("file"), updateExamController);
router.delete("/:id", auth, deleteExamController);

module.exports = router;
