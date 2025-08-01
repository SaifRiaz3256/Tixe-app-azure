const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json()); // parse JSON bodies

// In-memory "items" store
const items = new Map();

/**
 * API 1: Create an item
 * POST /items
 * Body: { name: string, description?: string }
 */
app.post("/items", (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });

  const id = uuidv4();
  const item = {
    id,
    name,
    description: description || "",
    createdAt: new Date().toISOString()
  };
  items.set(id, item);
  res.status(201).json(item);
});

/**
 * API 2: List all items
 * GET /items
 */
app.get("/items", (req, res) => {
  const all = Array.from(items.values());
  res.json(all);
});

/**
 * API 3: Get one item by ID
 * GET /items/:id
 */
app.get("/items/:id", (req, res) => {
  const item = items.get(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json(item);
});

/**
 * API 4: Update an item
 * PUT /items/:id
 * Body: { name?: string, description?: string }
 */
app.put("/items/:id", (req, res) => {
  const item = items.get(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const { name, description } = req.body;
  if (name !== undefined) item.name = name;
  if (description !== undefined) item.description = description;
  item.updatedAt = new Date().toISOString();

  items.set(item.id, item);
  res.json(item);
});

/**
 * API 5: Delete an item
 * DELETE /items/:id
 */
app.delete("/items/:id", (req, res) => {
  if (!items.has(req.params.id)) return res.status(404).json({ error: "Item not found" });
  items.delete(req.params.id);
  res.status(204).send();
});

/**
 * Health check
 * GET /health
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Fallback
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
