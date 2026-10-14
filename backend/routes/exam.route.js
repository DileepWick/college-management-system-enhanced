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
  uploadSchedule.single("file"),
  addExamController
);
router.patch(
  "/:id",
  auth,
  authorize("admin", "faculty"),
  uploadSchedule.single("file"),
  updateExamController
);
router.delete("/:id", auth, authorize("admin", "faculty"), deleteExamController);

module.exports = router;
