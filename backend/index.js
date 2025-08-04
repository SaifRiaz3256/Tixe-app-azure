const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  ContainerSASPermissions
} = require("@azure/storage-blob");

const app = express();
app.use(cors());
app.use(express.json());

// Multer in-memory storage for file upload
const upload = multer({ storage: multer.memoryStorage() });

// Azure SQL config (from App Service settings)
const config = {
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  options: {
    encrypt: true,
    enableArithAbort: true
  }
};

// Azure Blob Storage setup using connection string (key-based)
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.UPLOAD_CONTAINER_NAME || "uploads";

if (!connectionString) {
  console.error("Missing AZURE_STORAGE_CONNECTION_STRING environment variable.");
}

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Helper: generate a read-only SAS URL (1 hour) using account key
async function generateSASUrl(blobName) {
  // Parse account name and key
  const matches = connectionString.match(/AccountName=([^;]+);AccountKey=([^;]+);/);
  if (!matches) {
    throw new Error("Invalid connection string format for SAS generation");
  }
  const accountName = matches[1];
  const accountKey = matches[2];
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  const now = new Date();
  const expiry = new Date(now.valueOf() + 60 * 60 * 1000); // 1 hour

  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      startsOn: now,
      expiresOn: expiry,
      permissions: ContainerSASPermissions.parse("r")
    },
    sharedKeyCredential
  ).toString();

  const blobUrl = containerClient.getBlobClient(blobName).url;
  return `${blobUrl}?${sasToken}`;
}

// Route: Sign Up
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  try {
    await sql.connect(config);
    const result = await sql.query`SELECT * FROM users WHERE email = ${email}`;
    if (result.recordset.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    await sql.query`INSERT INTO users (email, password) VALUES (${email}, ${password})`;
    res.status(201).json({ success: true, message: "Signup successful" });
  } catch (err) {
    console.error("Signup error:", err);
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
    console.error("Signin error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Route: Upload Image
app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  try {
    // Ensure container exists
    await containerClient.createIfNotExists();

    // Blob name with original extension
    const originalName = req.file.originalname;
    const extension = originalName.includes(".") ? originalName.substring(originalName.lastIndexOf(".")) : "";
    const blobName = `${uuidv4()}${extension}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload buffer
    await blockBlobClient.uploadData(req.file.buffer, {
      blobHTTPHeaders: {
        blobContentType: req.file.mimetype
      }
    });

    // Generate SAS URL
    const urlWithSAS = await generateSASUrl(blobName);

    res.status(201).json({ success: true, url: urlWithSAS });
  } catch (err) {
    if (err.message && err.message.includes("Invalid connection string format")) {
      console.error("Upload error: SAS generation failed due to connection string parsing. Check AZURE_STORAGE_CONNECTION_STRING format.", err);
    } else {
      console.error("Upload error:", err);
    }
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// Optional debug endpoint
app.get("/debug-env", (req, res) => {
  res.json({
    AZURE_SQL_SERVER: process.env.AZURE_SQL_SERVER ? "present" : "missing",
    AZURE_SQL_DATABASE: process.env.AZURE_SQL_DATABASE ? "present" : "missing",
    AZURE_STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING ? "present" : "missing",
    UPLOAD_CONTAINER_NAME: process.env.UPLOAD_CONTAINER_NAME || "(defaulted)"
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
