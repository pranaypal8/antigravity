// ============================================================
// FILE UPLOAD MIDDLEWARE (Multer)
// ============================================================
// Handles image uploads for:
// - Product photos
// - Fabric texture images
// - Support ticket attachments
//
// Files are stored in /assets/images/ on the server.
// Max size: 5MB per file.
// Allowed formats: JPG, JPEG, PNG, WebP
// ============================================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ── Storage Configuration ─────────────────────────────────────
// Files are saved to disk (not memory) so large uploads don't crash the server
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine subfolder based on what's being uploaded
    let uploadFolder = 'products'; // default

    if (req.baseUrl.includes('fabric')) {
      uploadFolder = 'fabrics';
    } else if (req.baseUrl.includes('support')) {
      uploadFolder = 'tickets';
    }

    const uploadPath = path.join(__dirname, '../../assets/images', uploadFolder);

    // Create the directory if it doesn't exist yet
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    // Generate a unique filename: timestamp + random string + original extension
    // This prevents filename conflicts and overwrites
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

// ── File Type Validation ──────────────────────────────────────
// Only allow image files — reject anything else
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Only image files (JPG, PNG, WebP) are allowed.'), false);
  }
};

// ── Multer Instance ───────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,  // 5MB maximum per file
    files: 10,                   // Maximum 10 files per upload
  },
});

// ── Pre-configured Upload Functions ────────────────────────────
// Single file upload (e.g., fabric texture)
const uploadSingle = upload.single('image');

// Multiple files upload (e.g., product gallery, up to 10 photos)
const uploadMultiple = upload.array('images', 10);

// Error handler wrapper — converts multer errors to clean JSON responses
const handleUploadErrors = (uploadFn) => {
  return (req, res, next) => {
    uploadFn(req, res, (err) => {
      if (!err) return next();

      // Handle specific multer errors with friendly messages
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File is too large. Maximum size is 5MB.',
        });
      }

      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum 10 files allowed per upload.',
        });
      }

      // Other multer or custom errors
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.',
      });
    });
  };
};

module.exports = {
  uploadSingle: handleUploadErrors(uploadSingle),
  uploadMultiple: handleUploadErrors(uploadMultiple),
};
