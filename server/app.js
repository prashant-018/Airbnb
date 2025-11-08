// Core Module
const path = require('path');

// External Module
// Load .env from project root even if process is started in a subdirectory
const rootEnvPath = path.resolve(__dirname, '..', '.env');
const localEnvPath = path.resolve(__dirname, '.env');
let envLoaded = require('dotenv').config({ path: rootEnvPath });
if (envLoaded.error) {
  envLoaded = require('dotenv').config({ path: localEnvPath });
}

// Debug: Log environment loading
console.log('Environment loading status:', envLoaded.error ? 'Failed' : 'Success');
console.log('Root env path:', rootEnvPath);
console.log('Local env path:', localEnvPath);
const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const { default: mongoose } = require('mongoose');
const multer = require('multer');
// MongoDB connection with proper fallback
const DB_PATH = process.env.MONGO_URI || process.env.MONGO_DEV_URI || 'mongodb://127.0.0.1:27017/airbnb';

// Debug: Log which URI is being used
console.log('MONGO_URI from env:', process.env.MONGO_URI);
console.log('MONGO_DEV_URI from env:', process.env.MONGO_DEV_URI);
console.log('Using DB_PATH:', DB_PATH);

//Local Module
const storeRouter = require("./routes/storeRouter")
const hostRouter = require("./routes/hostRouter")
const authRouter = require("./routes/authRouter")
const rootDir = require("./utils/pathUtil");
const errorsController = require("./controllers/errors");

const app = express();

app.set('view engine', 'ejs');
const viewsPath = path.join(__dirname, '..', 'frontend', 'views');
app.set('views', viewsPath);
console.log('Views directory set to:', viewsPath);

const store = new MongoDBStore({
  uri: DB_PATH,
  collection: 'sessions',
  databaseName: 'airbnb'
});

const randomString = (length) => {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Ensure uploads directory exists - use server/uploads directory
// This matches where existing files are stored
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
} else {
  console.log('Using existing uploads directory:', uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename to handle spaces and special characters
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, randomString(10) + '-' + sanitizedOriginalName);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
}

const multerOptions = {
  storage, fileFilter
};

// DISABLE CSP IN DEVELOPMENT - Must be FIRST middleware
// Patch response object BEFORE any other middleware can set headers
const isDevelopment = process.env.NODE_ENV !== 'production';

if (isDevelopment) {
  // Use Node's 'header' event to intercept ALL headers before sending
  app.use((req, res, next) => {
    // Patch setHeader to block CSP
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = function (name, value) {
      if (name && typeof name === 'string' && name.toLowerCase() === 'content-security-policy') {
        return res; // Block CSP
      }
      return originalSetHeader(name, value);
    };

    // Patch writeHead
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = function (...args) {
      // Remove CSP from headers if present
      for (let i = 0; i < args.length; i++) {
        if (typeof args[i] === 'object' && args[i] !== null) {
          delete args[i]['Content-Security-Policy'];
          delete args[i]['content-security-policy'];
        }
      }
      return originalWriteHead.apply(this, args);
    };

    // Listen to 'header' event (fires just before headers are sent)
    res.once('header', () => {
      try {
        res.removeHeader('Content-Security-Policy');
      } catch (e) {
        // Header might not exist, that's fine
      }
    });

    next();
  });
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(multer(multerOptions).single('photo'));

// Configure static middleware - remove CSP in development
const staticOptions = isDevelopment ? {
  setHeaders: (res, path, stat) => {
    // Explicitly remove CSP header for static files in development
    try {
      res.removeHeader('Content-Security-Policy');
    } catch (e) {
      // Ignore if header doesn't exist
    }
  }
} : {};

app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), staticOptions))

// Serve uploaded files from server/uploads directory
// All routes point to the same directory for consistency
const uploadsStaticPath = path.join(__dirname, 'uploads');
app.use("/uploads", express.static(uploadsStaticPath, staticOptions))
app.use("/host/uploads", express.static(uploadsStaticPath, staticOptions))
app.use("/homes/uploads", express.static(uploadsStaticPath, staticOptions))

console.log('Static file serving configured:');
console.log('  - /uploads ->', uploadsStaticPath);
console.log('  - /host/uploads ->', uploadsStaticPath);
console.log('  - /homes/uploads ->', uploadsStaticPath);

app.use(session({
  secret: process.env.SESSION_SECRET || "KnowledgeGate AI with Complete Coding",
  resave: false,
  saveUninitialized: true,
  store
}));

app.use((req, res, next) => {
  req.isLoggedIn = req.session.isLoggedIn
  next();
})

app.use(authRouter)
app.use(storeRouter);
app.use("/host", (req, res, next) => {
  if (req.isLoggedIn) {
    next();
  } else {
    res.redirect("/login");
  }
});
app.use("/host", hostRouter);

// Final CSP removal middleware - runs before 404 handler
// Catches any CSP headers set by static middleware or error handlers
if (isDevelopment) {
  app.use((req, res, next) => {
    // Intercept the response object one more time before 404
    if (!res._cspRemoved) {
      res._cspRemoved = true;
      const originalWriteHead = res.writeHead;
      res.writeHead = function (...args) {
        // Remove CSP from headers before sending
        if (args.length >= 2 && typeof args[1] === 'object') {
          delete args[1]['Content-Security-Policy'];
          delete args[1]['content-security-policy'];
        }
        const result = originalWriteHead.apply(this, args);
        // Try to remove CSP after writeHead
        try {
          res.removeHeader('Content-Security-Policy');
        } catch (e) { }
        return result;
      };
    }
    next();
  });
}

app.use(errorsController.pageNotFound);

const PORT = Number(process.env.PORT || 3005);

// Validate DB_PATH before attempting connection
if (!DB_PATH || typeof DB_PATH !== 'string') {
  console.error('Error: No valid MongoDB URI found. Please check your .env file.');
  console.error('Expected MONGO_URI or MONGO_DEV_URI environment variables.');
  process.exit(1);
}

console.log("Attempting to connect to MongoDB...");
console.log("Using DB_PATH:", DB_PATH);

mongoose.connect(DB_PATH, { dbName: 'airbnb' }).then(() => {
  console.log('Connected to Mongo');

  const startServer = (port, retriesLeft = 2) => {
    const server = app.listen(port, () => {
      console.log(`Server running on address http://localhost:${port}`);
    });
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE' && retriesLeft > 0) {
        const nextPort = port + 1;
        console.warn(`Port ${port} in use. Retrying on ${nextPort}...`);
        startServer(nextPort, retriesLeft - 1);
      } else if (err) {
        console.error('Server failed to start:', err);
        process.exit(1);
      }
    });
  };

  startServer(PORT);
}).catch(err => {
  console.log('Error while connecting to Mongo: ', err);
});

