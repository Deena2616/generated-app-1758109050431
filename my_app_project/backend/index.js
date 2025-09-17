
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

// Load environment variables
dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const uri = process.env.MONGODB_URI || "mongodb://storedata:Brandmystore0102@3.109.161.66:5555/bms";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Session middleware configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: uri,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));

// Initialize MongoDB
let db;
let mongoInitialized = false;
async function initializeMongoDB() {
  if (mongoInitialized) return true;
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    db = client.db("demo");
    mongoInitialized = true;
    console.log('MongoDB initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize MongoDB:', error.message);
    mongoInitialized = false;
    return false;
  }
}

// Form submission endpoint
app.post('/submit-form', async (req, res) => {
  if (!mongoInitialized) {
    const initialized = await initializeMongoDB();
    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'MongoDB not initialized'
      });
    }
  }
  try {
    console.log('Received form data:', req.body);
    // Validate required fields
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: username, email, password'
      });
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }
    // Prepare form data with additional metadata
    const formData = {
      ...req.body,
      submittedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    // Save to MongoDB in "signup" collection
    const collection = db.collection("signup");
    const result = await collection.insertOne(formData);
    console.log('Form submitted with ID:', result.insertedId);
    res.status(200).json({
      success: true,
      id: result.insertedId.toString(),
      message: 'Form submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting form:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    mongo: mongoInitialized ? 'Initialized' : 'Not initialized'
  });
});

// Start server
initializeMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error.message);
  process.exit(1);
});
