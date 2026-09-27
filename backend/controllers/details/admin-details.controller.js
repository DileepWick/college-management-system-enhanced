const adminDetails = require("../../models/details/admin-details.model");
const resetToken = require("../../models/reset-password.model");
const bcrypt = require("bcryptjs");
const ApiResponse = require("../../utils/ApiResponse");
const jwt = require("jsonwebtoken");
const sendResetMail = require("../../utils/SendMail");
const {
  generateSecureEmployeeId,
  generateResetToken,
  hashToken,
} = require("../../utils/idGenerator");
const { pickProfileFields } = require("../../utils/pickFields");

// Fields an admin may set from the request body. Privilege and server-managed
// fields (isSuperAdmin, employeeId, password, googleId, profile, _id) are never copied.
const ADMIN_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "pincode",
  "country",
  "gender",
  "dob",
  "designation",
  "joiningDate",
  "salary",
  "status",
  "bloodGroup",
];

const loginAdminController = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await adminDetails.findOne({ email });

    if (!user) {
      return ApiResponse.notFound("User not found").send(res);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return ApiResponse.unauthorized("Invalid password").send(res);
    }

    const token = jwt.sign(
      { userId: user._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return ApiResponse.success({ token }, "Login successful").send(res);
  } catch (error) {
    console.error("Login Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const getAllDetailsController = async (req, res, next) => {
  try {
    const users = await adminDetails.find().select("-__v -password");

    if (!users || users.length === 0) {
      return ApiResponse.notFound("No Admin Found").send(res);
    }

    return ApiResponse.success(users, "Admin Details Found!").send(res);
  } catch (error) {
    console.error("Get Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};



const registerAdminController = async (req, res, next) => {
  try {
    const { email, phone } = req.body;

    const profile = req.file.filename;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiResponse.badRequest("Invalid email format").send(res);
    }

    if (!/^\d{10}$/.test(phone)) {
      return ApiResponse.badRequest("Phone number must be 10 digits").send(res);
    }

    const existingAdmin = await adminDetails.findOne({
      $or: [{ phone }, { email }],
    });

    if (existingAdmin) {
      return ApiResponse.conflict(
        "Admin with these details already exists"
      ).send(res);
    }

    const employeeId = generateSecureEmployeeId();

    const user = await adminDetails.create({
      ...pickProfileFields(req.body, ADMIN_PROFILE_FIELDS),
      employeeId,
      profile,
      password: "admin123",
    });

    const sanitizedUser = await adminDetails
      .findById(user._id)
      .select("-__v -password");

    return ApiResponse.created(sanitizedUser, "Admin Details Added!").send(res);
  } catch (error) {
    console.error("Add Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const getMyDetailsController = async (req, res, next) => {
  try {
    const user = await adminDetails
      .findById(req.userId)
      .select("-password -__v");

    if (!user) {
      return ApiResponse.notFound("User not found").send(res);
    }

    return ApiResponse.success(user, "My Details Found!").send(res);
  } catch (error) {
    console.error("Get My Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const updateDetailsController = async (req, res, next) => {
  try {
    if (!req.params.id) {
      return ApiResponse.badRequest("Admin ID is required").send(res);
    }

    const updateData = pickProfileFields(req.body, ADMIN_PROFILE_FIELDS);
    const { email, phone } = updateData;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiResponse.badRequest("Invalid email format").send(res);
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      return ApiResponse.badRequest("Phone number must be 10 digits").send(res);
    }

    if (phone) {
      const existingAdmin = await adminDetails.findOne({
        _id: { $ne: req.params.id },
        phone: phone,
      });

      if (existingAdmin) {
        return ApiResponse.conflict("Phone number already in use").send(res);
      }
    }

    if (email) {
      const existingAdmin = await adminDetails.findOne({
        _id: { $ne: req.params.id },
        email: email,
      });

      if (existingAdmin) {
        return ApiResponse.conflict("Email already in use").send(res);
      }
    }

    if (req.file) {
      updateData.profile = req.file.filename;
    }

    if (updateData.dob) {
      updateData.dob = new Date(updateData.dob);
    }
    if (updateData.joiningDate) {
      updateData.joiningDate = new Date(updateData.joiningDate);
    }

    const updatedUser = await adminDetails
      .findByIdAndUpdate(req.params.id, updateData, { new: true })
      .select("-__v -password");

    if (!updatedUser) {
      return ApiResponse.notFound("Admin not found").send(res);
    }

    return ApiResponse.success(updatedUser, "Updated Successfully!").send(res);
  } catch (error) {
    console.error("Update Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const deleteDetailsController = async (req, res, next) => {
  try {
    if (!req.params.id) {
      return ApiResponse.badRequest("Admin ID is required").send(res);
    }

    const user = await adminDetails.findById(req.params.id);

    if (!user) {
      return ApiResponse.notFound("No Admin Found").send(res);
    }

    await adminDetails.findByIdAndDelete(req.params.id);

    return ApiResponse.success(null, "Deleted Successfully!").send(res);
  } catch (error) {
    console.error("Delete Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const sendForgetPasswordEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return ApiResponse.badRequest("Email is required").send(res);
    }

    const user = await adminDetails.findOne({ email });

    // OWASP recommendation: Prevent user enumeration with generic response
    if (!user) {
      return ApiResponse.success(
        null,
        "If an account with that email exists, a password reset link has been sent."
      ).send(res);
    }

    const { rawToken, tokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await resetToken.deleteMany({
      type: "AdminDetails",
      userId: user._id,
    });

    await resetToken.create({
      tokenHash,
      expiresAt,
      type: "AdminDetails",
      userId: user._id,
    });

    await sendResetMail(user.email, rawToken, "admin");

    return ApiResponse.success(
      null,
      "If an account with that email exists, a password reset link has been sent."
    ).send(res);
  } catch (error) {
    console.error("Delete Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const updatePasswordHandler = async (req, res) => {
  try {
    const { resetId } = req.params;
    const { password } = req.body;

    if (!resetId || !password) {
      return ApiResponse.badRequest(
        "Password and Reset Token are required"
      ).send(res);
    }

    if (password.length < 8) {
      return ApiResponse.badRequest(
        "Password must be at least 8 characters long"
      ).send(res);
    }

    const tokenHash = hashToken(resetId);

    const resetRecord = await resetToken.findOne({
      tokenHash,
      type: "AdminDetails",
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return ApiResponse.badRequest(
        "Invalid or expired password reset link"
      ).send(res);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await adminDetails.findByIdAndUpdate(resetRecord.userId, {
      password: hashedPassword,
    });

    // Single-use: delete used token immediately
    await resetToken.deleteMany({
      type: "AdminDetails",
      userId: resetRecord.userId,
    });

    return ApiResponse.success(null, "Password Updated Successfully!").send(res);
  } catch (error) {
    console.error("Update Password Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const updateLoggedInPasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return ApiResponse.badRequest(
        "Current password and new password are required"
      ).send(res);
    }

    if (newPassword.length < 8) {
      return ApiResponse.badRequest(
        "New password must be at least 8 characters long"
      ).send(res);
    }

    const user = await adminDetails.findById(userId);
    if (!user) {
      return ApiResponse.notFound("User not found").send(res);
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return ApiResponse.unauthorized("Current password is incorrect").send(
        res
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await adminDetails.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });

    return ApiResponse.success(null, "Password updated successfully").send(res);
  } catch (error) {
    console.error("Update Password Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

module.exports = {
  loginAdminController,
  getAllDetailsController,
  registerAdminController,
  updateDetailsController,
  deleteDetailsController,
  getMyDetailsController,
  sendForgetPasswordEmail,
  updatePasswordHandler,
  updateLoggedInPasswordController,
};
