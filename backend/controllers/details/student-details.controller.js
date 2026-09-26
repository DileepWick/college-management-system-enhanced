const studentDetails = require("../../models/details/student-details.model");
const resetToken = require("../../models/reset-password.model");
const bcrypt = require("bcryptjs");
const ApiResponse = require("../../utils/ApiResponse");
const jwt = require("jsonwebtoken");
const sendResetMail = require("../../utils/SendMail");
const {
  generateSecureEnrollmentNo,
  generateResetToken,
  hashToken,
} = require("../../utils/idGenerator");

const loginStudentController = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await studentDetails.findOne({ email });

    if (!user) {
      return ApiResponse.notFound("User not found").send(res);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return ApiResponse.unauthorized("Invalid password").send(res);
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    return ApiResponse.success({ token }, "Login successful").send(res);
  } catch (error) {
    console.error("Login Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const getAllDetailsController = async (req, res) => {
  try {
    const users = await studentDetails
      .find()
      .select("-__v -password")
      .populate("branchId");

    if (!users || users.length === 0) {
      return ApiResponse.notFound("No Student Found").send(res);
    }

    return ApiResponse.success(users, "Student Details Found!").send(res);
  } catch (error) {
    console.error("Get Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const registerStudentController = async (req, res) => {
  try {
    const { email, phone } = req.body;
    const profile = req.file.filename;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiResponse.badRequest("Invalid email format").send(res);
    }

    if (!/^\d{10}$/.test(phone)) {
      return ApiResponse.badRequest("Phone number must be 10 digits").send(res);
    }

    const existing = await studentDetails.findOne({
      $or: [{ phone }, { email }],
    });
    if (existing) {
      return ApiResponse.conflict(
        "Student with these details already exists"
      ).send(res);
    }

    const enrollmentNo = generateSecureEnrollmentNo();

    const user = await studentDetails.create({
      ...req.body,
      profile,
      password: "student123",
      enrollmentNo,
      googleId: undefined,
    });

    const sanitizedUser = await studentDetails
      .findById(user._id)
      .select("-__v -password");

    return ApiResponse.created(sanitizedUser, "Student Details Added!").send(
      res
    );
  } catch (error) {
    console.error("Add Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const getMyDetailsController = async (req, res) => {
  try {
    const user = await studentDetails
      .findById(req.userId)
      .select("-password -__v")
      .populate("branchId");

    if (!user) {
      return ApiResponse.notFound("User not found").send(res);
    }

    return ApiResponse.success(user, "My Details Found!").send(res);
  } catch (error) {
    console.error("Get My Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const updateDetailsController = async (req, res) => {
  try {
    if (!req.params.id) {
      return ApiResponse.badRequest("Student ID is required").send(res);
    }

    const updateData = { ...req.body };
    delete updateData.googleId;
    const { email, phone, password, enrollmentNo } = updateData;

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ApiResponse.badRequest("Invalid email format").send(res);
    }

    if (phone && !/^\d{10}$/.test(phone)) {
      return ApiResponse.badRequest("Phone number must be 10 digits").send(res);
    }

    if (password && password.length < 8) {
      return ApiResponse.badRequest(
        "Password must be at least 8 characters long"
      ).send(res);
    }

    if (phone) {
      const existingStudent = await studentDetails.findOne({
        _id: { $ne: req.params.id },
        phone: phone,
      });

      if (existingStudent) {
        return ApiResponse.conflict("Phone number already in use").send(res);
      }
    }

    if (email) {
      const existingStudent = await studentDetails.findOne({
        _id: { $ne: req.params.id },
        email: email,
      });

      if (existingStudent) {
        return ApiResponse.conflict("Email already in use").send(res);
      }

      // A new email must be re-linked to its own Google account
      const current = await studentDetails
        .findById(req.params.id)
        .select("email");
      if (current && current.email !== email) {
        updateData.$unset = { googleId: 1 };
      }
    }

    if (enrollmentNo) {
      const existingStudent = await studentDetails.findOne({
        _id: { $ne: req.params.id },
        enrollmentNo: enrollmentNo,
      });

      if (existingStudent) {
        return ApiResponse.conflict("Enrollment number already in use").send(
          res
        );
      }
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
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

    const updatedUser = await studentDetails
      .findByIdAndUpdate(req.params.id, updateData, { new: true })
      .select("-__v -password");

    if (!updatedUser) {
      return ApiResponse.notFound("Student not found").send(res);
    }

    return ApiResponse.success(updatedUser, "Updated Successfully!").send(res);
  } catch (error) {
    console.error("Update Details Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const deleteDetailsController = async (req, res) => {
  try {
    if (!req.params.id) {
      return ApiResponse.badRequest("Student ID is required").send(res);
    }

    const user = await studentDetails.findById(req.params.id);

    if (!user) {
      return ApiResponse.notFound("No Student Found").send(res);
    }

    await studentDetails.findByIdAndDelete(req.params.id);

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

    const user = await studentDetails.findOne({ email });

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
      type: "StudentDetails",
      userId: user._id,
    });

    await resetToken.create({
      tokenHash,
      expiresAt,
      type: "StudentDetails",
      userId: user._id,
    });

    await sendResetMail(user.email, rawToken, "student");

    return ApiResponse.success(
      null,
      "If an account with that email exists, a password reset link has been sent."
    ).send(res);
  } catch (error) {
    console.error("Send Reset Mail Error: ", error);
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
      type: "StudentDetails",
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return ApiResponse.badRequest(
        "Invalid or expired password reset link"
      ).send(res);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await studentDetails.findByIdAndUpdate(resetRecord.userId, {
      password: hashedPassword,
    });

    // Single-use: delete used token immediately
    await resetToken.deleteMany({
      type: "StudentDetails",
      userId: resetRecord.userId,
    });

    return ApiResponse.success(null, "Password Updated Successfully!").send(res);
  } catch (error) {
    console.error("Update Password Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

const searchStudentsController = async (req, res) => {
  try {
    const { enrollmentNo, name, semester, branch } = req.body;
    let query = {};

    if (!enrollmentNo && !name && !semester && !branch) {
      return ApiResponse.badRequest("Select at least one filter").send(res);
    }

    if (enrollmentNo) {
      query.enrollmentNo = enrollmentNo;
    }

    if (name) {
      query.$or = [
        { firstName: { $regex: name, $options: "i" } },
        { middleName: { $regex: name, $options: "i" } },
        { lastName: { $regex: name, $options: "i" } },
      ];
    }

    if (semester) {
      query.semester = semester;
    }

    if (branch) {
      query.branchId = branch;
    }

    const students = await studentDetails
      .find(query)
      .select("-password -__v")
      .populate("branchId")
      .sort({ enrollmentNo: 1 });

    if (!students || students.length === 0) {
      return ApiResponse.notFound("No students found").send(res);
    }

    return ApiResponse.success(students, "Students found successfully").send(
      res
    );
  } catch (error) {
    console.error("Search Students Error: ", error);
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

    const user = await studentDetails.findById(userId);
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

    await studentDetails.findByIdAndUpdate(userId, {
      password: hashedPassword,
    });

    return ApiResponse.success(null, "Password updated successfully").send(res);
  } catch (error) {
    console.error("Update Password Error: ", error);
    return ApiResponse.internalServerError().send(res);
  }
};

module.exports = {
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
};
