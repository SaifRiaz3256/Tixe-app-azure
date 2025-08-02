// In-memory user store (replace later with PostgreSQL)
const users = new Map();

// Basic email+password validation
function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

app.post("/signup", (req, res) => {
  const { email, password } = req.body;
  if (!validateEmail(email)) return res.status(400).json({ error: "Invalid email" });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  if (users.has(email)) return res.status(409).json({ error: "User already exists" });

  users.set(email, { email, password }); // store plain password for now
  res.status(201).json({ message: "User created successfully" });
});

app.post("/signin", (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ message: "Login successful" });
});
