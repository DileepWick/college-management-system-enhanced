const studentDetails = require("../models/details/student-details.model");
const facultyDetails = require("../models/details/faculty-details.model");
const adminDetails = require("../models/details/admin-details.model");

// Each role lives in its own collection, so the role decides which model to query.
// Null prototype so lookups like ROLE_MODELS["constructor"] stay undefined.
const ROLE_MODELS = Object.freeze(
  Object.assign(Object.create(null), {
    student: studentDetails,
    faculty: facultyDetails,
    admin: adminDetails,
  })
);

module.exports = { ROLE_MODELS };
