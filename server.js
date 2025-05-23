require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const planRoutes = require("./routes/plans");
const roRoutes = require("./routes/romaster");
const statusRoutes = require("./routes/statusmodel");

const app = express();
connectDB();

app.use(
  cors({
    origin: "https://relconecz-database.onrender.com", // ✅ specify your frontend
    credentials: true, // ✅ allow cookies
  })
);

// app.use(cors({ credentials: true, origin: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// app.use(
//   session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     cookie: { maxAge: 15 * 60 * 1000 },
//   })
// );

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 15 * 60 * 1000,
      secure: true, // ✅ Required for HTTPS on Render
      sameSite: "None", // ✅ Required for cross-origin cookies
    },
  })
);

app.use(express.static("public"));

// API Routes
app.use("/", authRoutes);
app.use("/", roRoutes);
app.use("/", planRoutes);
app.use("/", statusRoutes);

// app.get("/auth", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "login.html"));
// });
// Redirect all *.html URLs to clean ones
app.use((req, res, next) => {
  if (req.path.endsWith(".html")) {
    const cleanPath = req.path.slice(0, -5); // remove '.html'
    return res.redirect(301, cleanPath); // permanent redirect
  }
  next();
});

// Serve static files from 'public'
app.use(express.static(path.join(__dirname, "public")));

// Route: root → auth.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Route: /dashboard → dashboard.html etc.
app.get("/:page", (req, res, next) => {
  const filePath = path.join(__dirname, "public", `${req.params.page}.html`);
  res.sendFile(filePath, (err) => {
    if (err) next(); // 404 fallback
  });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
