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
    origin: "https://relconecz1.netlify.app", // ✅ your frontend
    credentials: true,
  })
);

// ✅ Handle preflight requests for all routes
app.options("*", cors());

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

// Static files
app.use(express.static("public"));

// API Routes
app.use("/", authRoutes);
app.use("/", roRoutes);
app.use("/", planRoutes);
app.use("/", statusRoutes);

// ❌ REMOVE this route completely:
// app.get("/:page", ...);

// Final fallback route
app.use((req, res) => {
  res.status(404).send("Page not found");
});

app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});
