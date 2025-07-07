require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");
const { router: authRoutes } = require("./routes/auth");
const planRoutes = require("./routes/plans");
const roRoutes = require("./routes/romaster");
const statusRoutes = require("./routes/statusmodel");
const atgstatusRoutes = require("./routes/atgStatusRoutes");
const auditRoutes = require("./routes/audit");
const taskRoutes = require("./routes/taskRoutes");
const jioBPStatusRoutes = require("./routes/jioBPStatusRoutes");

const app = express();

// ✅ Connect to MongoDB
connectDB();

// ✅ Allow only these origins
const allowedOrigins = [
  "https://relconecz1.netlify.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Trust proxy (for Render / Heroku)
app.set("trust proxy", true);

// ✅ Serve static files (optional)
app.use(express.static("public"));

// ✅ Routes
app.get("/", (req, res) => {
  res.send("✅ RELCON Backend is running");
});

app.use("/", authRoutes);
app.use("/romaster", roRoutes);
app.use("/", planRoutes);
app.use("/", statusRoutes);
app.use("/", atgstatusRoutes);
app.use("/audit", auditRoutes);
app.use(taskRoutes);
app.use("/", jioBPStatusRoutes);

// ✅ Redirect *.html to clean path
app.use((req, res, next) => {
  if (req.path.endsWith(".html")) {
    const cleanPath = req.path.slice(0, -5);
    return res.redirect(301, cleanPath);
  }
  next();
});

// ✅ 404 fallback
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// ✅ Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
