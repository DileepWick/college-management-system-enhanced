const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multer.middleware");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
const {
  getMaterialsController,
  addMaterialController,
  updateMaterialController,
  deleteMaterialController,
} = require("../controllers/material.controller");

// Materials are owned by the uploading faculty (material.faculty = req.userId)
router.get("/", auth, getMaterialsController);
router.post(
  "/",
  auth,
  authorize("faculty"),
  upload.single("file"),
  addMaterialController
);
router.put(
  "/:id",
  auth,
  authorize("faculty"),
  upload.single("file"),
  updateMaterialController
);
router.delete("/:id", auth, authorize("faculty"), deleteMaterialController);

module.exports = router;
