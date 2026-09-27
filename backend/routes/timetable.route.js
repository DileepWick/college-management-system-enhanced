require("dotenv").config();
const express = require("express");
const router = express.Router();
const { uploadSchedule } = require("../middlewares/multer.middleware");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
const {
  getTimetableController,
  addTimetableController,
  updateTimetableController,
  deleteTimetableController,
} = require("../controllers/timetable.controller");

router.get("/", auth, getTimetableController);

router.post(
  "/",
  auth,
  authorize("admin", "faculty"),
  upload.single("file"),
  addTimetableController
);

router.put(
  "/:id",
  auth,
  authorize("admin", "faculty"),
  upload.single("file"),
  updateTimetableController
);
router.post("/", auth, uploadSchedule.single("file"), addTimetableController);

router.put("/:id", auth, uploadSchedule.single("file"), updateTimetableController);

router.delete(
  "/:id",
  auth,
  authorize("admin", "faculty"),
  deleteTimetableController
);

module.exports = router;
