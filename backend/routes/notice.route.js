const express = require("express");
const {
  getNoticeController,
  addNoticeController,
  updateNoticeController,
  deleteNoticeController,
} = require("../controllers/notice.controller");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
const router = express.Router();

router.get("/", auth, getNoticeController);
router.post("/", auth, authorize("admin", "faculty"), addNoticeController);
router.put("/:id", auth, authorize("admin", "faculty"), updateNoticeController);
router.delete(
  "/:id",
  auth,
  authorize("admin", "faculty"),
  deleteNoticeController
);

module.exports = router;
