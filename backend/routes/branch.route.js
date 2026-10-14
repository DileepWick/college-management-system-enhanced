const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
const {
  getBranchController,
  addBranchController,
  updateBranchController,
  deleteBranchController,
} = require("../controllers/branch.controller");

router.get("/", auth, getBranchController);
router.post("/", auth, authorize("admin"), addBranchController);
router.patch("/:id", auth, authorize("admin"), updateBranchController);
router.delete("/:id", auth, authorize("admin"), deleteBranchController);

module.exports = router;
