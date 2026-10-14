const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const ApiResponse = require("../utils/ApiResponse");

const MEDIA_DIR = path.join(__dirname, "../media");
if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

// Storage configuration with secure UUID naming and lowercase extension
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, MEDIA_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

/**
 * Factory to create context-aware Multer uploader with dual MIME and extension validation,
 * file size enforcement, and automatic ApiResponse error handling.
 */
const createUploader = ({
  allowedExtensions,
  allowedMimeTypes,
  maxFileSize,
  typeLabel,
}) => {
  const multerInstance = multer({
    storage,
    limits: {
      fileSize: maxFileSize,
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype.toLowerCase();

      const isValidExt = allowedExtensions.includes(ext);
      const isValidMime = allowedMimeTypes.includes(mime);

      if (!isValidExt || !isValidMime) {
        return cb(
          new Error(
            `Invalid file type for ${typeLabel}. Allowed extensions: ${allowedExtensions.join(", ")}`
          ),
          false
        );
      }

      cb(null, true);
    },
  });

  return {
    single: (fieldName = "file") => {
      const uploadSingle = multerInstance.single(fieldName);
      return (req, res, next) => {
        uploadSingle(req, res, (err) => {
          if (err) {
            if (err instanceof multer.MulterError) {
              if (err.code === "LIMIT_FILE_SIZE") {
                const sizeMb = Math.round(maxFileSize / (1024 * 1024));
                return ApiResponse.badRequest(
                  `File size exceeds the allowed limit of ${sizeMb}MB for ${typeLabel}`
                ).send(res);
              }
              return ApiResponse.badRequest(`Upload error: ${err.message}`).send(res);
            }
            return ApiResponse.badRequest(err.message || "File upload failed").send(res);
          }
          next();
        });
      };
    },
    raw: multerInstance,
  };
};

// 1. Profile photos (Student, Faculty, Admin): Images only, max 2MB
const uploadImage = createUploader({
  allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSize: 2 * 1024 * 1024,
  typeLabel: "profile image",
});

// 2. Study materials (Notes, Syllabus, Assignments): Documents & standard images, max 10MB
const uploadDocument = createUploader({
  allowedExtensions: [
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".txt",
    ".zip",
    ".jpg",
    ".jpeg",
    ".png",
  ],
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
    "image/jpeg",
    "image/png",
  ],
  maxFileSize: 10 * 1024 * 1024,
  typeLabel: "study material",
});

// 3. Schedules & Timetables (Timetables, Exam schedules): PDF and images, max 5MB
const uploadSchedule = createUploader({
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png"],
  allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  maxFileSize: 5 * 1024 * 1024,
  typeLabel: "timetable/exam document",
});

// Allow both default-import compatibility and named destructuring
const upload = uploadImage;
upload.upload = upload;
upload.uploadImage = uploadImage;
upload.uploadDocument = uploadDocument;
upload.uploadSchedule = uploadSchedule;

module.exports = upload;

