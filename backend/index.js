const connectToMongo = require("./database/db");
const express = require("express");
const app = express();
const path = require("path");
connectToMongo();
const port = 4000 || process.env.PORT;
var cors = require("cors");
const helmet = require("helmet");

// Security headers: CSP, X-Frame-Options, HSTS, nosniff, Referrer-Policy;
// also removes X-Powered-By. Framing is denied outright (clickjacking).
// CORP is relaxed so the frontend (another origin) can still load /media images.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { frameAncestors: ["'none'"] },
    },
    frameguard: { action: "deny" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_API_LINK,
  })
);

app.use(express.json()); //to convert request data to json

app.get("/", (req, res) => {
  res.send("Hello 👋 I am Working Fine 🚀");
});

// Uploaded files are untrusted: no scripts or external loads, never framed.
// object-src 'self' keeps the browser's PDF viewer working for materials.
app.use(
  "/media",
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'"],
      mediaSrc: ["'self'"],
      objectSrc: ["'self'"],
      styleSrc: ["'unsafe-inline'"],
      frameAncestors: ["'none'"],
    },
  }),
  express.static(path.join(__dirname, "media"))
);

app.use("/api/auth", require("./routes/auth.route"));
app.use("/api/admin", require("./routes/details/admin-details.route"));
app.use("/api/faculty", require("./routes/details/faculty-details.route"));
app.use("/api/student", require("./routes/details/student-details.route"));

app.use("/api/branch", require("./routes/branch.route"));
app.use("/api/subject", require("./routes/subject.route"));
app.use("/api/notice", require("./routes/notice.route"));
app.use("/api/timetable", require("./routes/timetable.route"));
app.use("/api/material", require("./routes/material.route"));
app.use("/api/exam", require("./routes/exam.route"));
app.use("/api/marks", require("./routes/marks.route"));

app.listen(port, () => {
  console.log(`Server Listening On http://localhost:${port}`);
});
