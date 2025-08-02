const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

// Azure SQL config (stored securely in App Service settings)
const config = {
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER, // e.g., yourserver.database.windows.net
  database: process.env.AZURE_SQL_DATABASE,
  options: {
    encrypt: true,
    enableArithAbort: true
  }
};

// Route: Sign Up
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  const id = uuidv4();

  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
    if (result.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    await sql.query`INSERT INTO users (id, email, password) VALUES (${id}, ${email}, ${password})`;
    res.status(201).json({ success: true, message: "Signup successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Route: Sign In
app.post("/signin", async (req, res) => {
  const { email, password } = req.body;

  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM users WHERE email = ${email} AND password = ${password}`;
    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    res.json({ success: true, message: "Signin successful", userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
