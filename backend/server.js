require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const planRoutes = require("./routes/plans");
const roRoutes = require("./routes/romaster");
const statusRoutes = require("./routes/statusmodel");
const atgstatusRoutes = require("./routes/atgStatusRoutes");
const auditRoutes = require("./routes/audit");
const { router: authRoutes } = require("./routes/auth");

const app = express();

// ✅ Connect to MongoDB
connectDB();

// ✅ CORS setup for frontend → Netlify
app.use(
  cors({
    origin: "https://relconecz1.netlify.app",
    credentials: true,
  })
);

// ✅ Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Trust proxy for HTTPS (still useful)
app.set("trust proxy", 1);

// ✅ Static files (optional)
app.use(express.static("public"));

// ✅ Routes
app.use("/", authRoutes);
app.use("/", roRoutes);
app.use("/", planRoutes);
app.use("/", statusRoutes);
app.use("/", atgstatusRoutes);
app.use("/", auditRoutes);

// ✅ Optional: redirect *.html to clean path
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
