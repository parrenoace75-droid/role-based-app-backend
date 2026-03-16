const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;
const SECRET_KEY = "secretkey123";

// ── Middleware ────────────────────────────────────────
app.use(cors()); 
app.use(express.json());

// ── In-memory user storage ────────────────────────────
let users = [
  {
    id: 1,
    username: "admin@example.com",
    password: bcrypt.hashSync("admin123", 10),
    role: "admin"
  },
  { 
    id: 2, 
    username: "alice@example.com",
    password: bcrypt.hashSync("user123", 10),
    role: "user"
  } 
];

// ── Middleware: Verify Token ──────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Access token required" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
}

// ── Middleware: Check Role ────────────────────────────
function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

// ── Routes ────────────────────────────────────────────

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET_KEY,
    { expiresIn: "1h" }
  );

  res.json({ token, role: user.role });
});

app.get("/api/admin/dashboard", authenticateToken, authorizeRole("admin"), (req, res) => {
  res.json({ message: "Welcome to the admin dashboard" });
});

// ── Start server ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});