const express = require("express");
const {
  getMarksController,
  addMarksController,
  deleteMarksController,
  addBulkMarksController,
  getStudentsWithMarksController,
  getStudentMarksController,
} = require("../controllers/marks.controller");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
const router = express.Router();

// Students only ever read their own marks (/student uses req.userId);
// every route that takes a student ID from the request is staff-only
const staffOnly = authorize("admin", "faculty");

router.get("/", auth, staffOnly, getMarksController);
router.get("/students", auth, staffOnly, getStudentsWithMarksController);
router.get("/student", auth, authorize("student"), getStudentMarksController);
router.post("/", auth, staffOnly, addMarksController);
router.post("/bulk", auth, staffOnly, addBulkMarksController);
router.delete("/:id", auth, staffOnly, deleteMarksController);

module.exports = router;
