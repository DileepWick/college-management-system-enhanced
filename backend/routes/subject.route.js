const express = require("express");
const {
  getSubjectController,
  addSubjectController,
  deleteSubjectController,
  updateSubjectController,
} = require("../controllers/subject.controller");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
router.get("/", auth, getSubjectController);
router.post("/", auth, authorize("admin"), addSubjectController);
router.delete("/:id", auth, authorize("admin"), deleteSubjectController);
router.put("/:id", auth, authorize("admin"), updateSubjectController);

module.exports = router;
