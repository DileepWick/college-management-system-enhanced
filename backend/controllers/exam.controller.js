const Exam = require("../models/exam.model");
const ApiResponse = require("../utils/ApiResponse");
const { pickFields } = require("../utils/pickFields");

// timetableLink is only ever set from the uploaded file, never from the body
const EXAM_FIELDS = ["name", "date", "semester", "examType", "totalMarks"];

const {
  toSafeSearchPattern,
  sanitizeSearchInput,
} = require("../utils/regexHelper");

const getAllExamsController = async (req, res) => {
  try {
    const { search = "", examType = "", semester = "" } = req.query;

    let query = {};

    if (semester) {
      const sanitizedSemester = Number(semester);
      if (!isNaN(sanitizedSemester)) {
        query.semester = sanitizedSemester;
      }
    }

    if (examType) {
      const sanitizedType = sanitizeSearchInput(examType, 20);
      if (sanitizedType) {
        query.examType = sanitizedType;
      }
    }

    const safeSearch = toSafeSearchPattern(search, 50);
    if (safeSearch) {
      query.name = { $regex: safeSearch, $options: "i" };
    }

    const exams = await Exam.find(query);

    if (!exams || exams.length === 0) {
      return ApiResponse.error("No Exams Found", 404).send(res);
    }

    return ApiResponse.success(exams, "All Exams Loaded!").send(res);
  } catch (error) {
    return ApiResponse.error(error.message).send(res);
  }
};

const addExamController = async (req, res) => {
  try {
    const formData = pickFields(req.body, EXAM_FIELDS);
    if (req.file) {
      formData.timetableLink = req.file.filename;
    }
    const exam = await Exam.create(formData);
    return ApiResponse.success(exam, "Exam Added Successfully!").send(res);
  } catch (error) {
    return ApiResponse.error(error.message).send(res);
  }
};

const updateExamController = async (req, res) => {
  try {
    const formData = pickFields(req.body, EXAM_FIELDS);
    if (req.file) {
      formData.timetableLink = req.file.filename;
    }
    const exam = await Exam.findByIdAndUpdate(req.params.id, formData, {
      new: true,
    });
    return ApiResponse.success(exam, "Exam Updated Successfully!").send(res);
  } catch (error) {
    return ApiResponse.error(error.message).send(res);
  }
};

const deleteExamController = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    return ApiResponse.success(exam, "Exam Deleted Successfully!").send(res);
  } catch (error) {
    return ApiResponse.error(error.message).send(res);
  }
};

module.exports = {
  getAllExamsController,
  addExamController,
  updateExamController,
  deleteExamController,
};
