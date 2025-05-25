const express = require("express");
const cors = require("cors"); // ✅ EARLY
const app = express();

app.use(
  cors({
    origin: "https://relconecz1.netlify.app", // ✅ your frontend URL
    credentials: true,
  })
);

// ✅ Add this line to handle preflight OPTIONS requests
app.options("*", cors()); // <------ THIS IS REQUIRED

const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const planRoutes = require("./routes/plans");
const roRoutes = require("./routes/romaster");
const statusRoutes = require("./routes/statusmodel");

connectDB();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 15 * 60 * 1000,
      secure: false,
      sameSite: "Lax",
    },
  })
);

// API Routes
app.use("/", authRoutes);
app.use("/", roRoutes);
app.use("/", planRoutes);
app.use("/", statusRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  if (req.path.endsWith(".html")) {
    const cleanPath = req.path.slice(0, -5);
    return res.redirect(301, cleanPath);
  }
  next();
});

// fallback routes
app.get("/page/:name", (req, res, next) => {
  const filePath = path.join(__dirname, "public", `${req.params.name}.html`);
  res.sendFile(filePath, (err) => {
    if (err) next();
  });
});

app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
