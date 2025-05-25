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

// ✅ CORS
app.use(
  cors({
    origin: "https://relconecz1.netlify.app",
    credentials: true,
  })
);
app.options("*", cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallbackSecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 15 * 60 * 1000,
      secure: false,
      sameSite: "Lax",
    },
  })
);

// ✅ Static files
app.use(express.static(path.join(__dirname, "public")));

// ✅ Routes
app.use("/", authRoutes);
app.use("/", roRoutes);
app.use("/", planRoutes);
app.use("/", statusRoutes);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("✅ Backend is running!");
});

// ❌ Remove this (causes Render crash):
// app.get("/:page", ...);

// ✅ 404 fallback
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// ✅ Server
app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
