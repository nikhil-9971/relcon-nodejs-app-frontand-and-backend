require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const planRoutes = require("./routes/plans");
const roRoutes = require("./routes/romaster");
const statusRoutes = require("./routes/statusmodel");

const app = express();

// ✅ Connect to MongoDB
connectDB();

const allowedOrigins = ["https://relconecz1.netlify.app"];

app.options(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ✅ CORS setup for frontend → Netlify
// app.use(
//   cors({
//     origin: "https://relconecz1.netlify.app",
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// ✅ Needed for cookies to work cross-origin
app.set("trust proxy", 1);

// ✅ Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// ✅ Session configuration for cross-origin
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 15 * 60 * 1000, // 15 minutes
      secure: true, // ✅ required for HTTPS (Netlify + Render)
      sameSite: "none", // ✅ allow cookies cross-origin
      httpOnly: true,
    },
  })
);

// ✅ Static files
app.use(express.static("public"));

// ✅ Routes
app.use("/", authRoutes);
app.use("/", roRoutes);
app.use("/", planRoutes);
app.use("/", statusRoutes);

// ✅ Optional: redirect *.html → clean path
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
