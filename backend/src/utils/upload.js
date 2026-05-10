/**
 * upload.js — Multer configuration for all file uploads
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BLOG FEATURED IMAGES      upload.single('image')
 *   Accepted:  WebP, PNG
 *   Rejected:  JPEG, GIF, SVG, HEIC, everything else
 *   Max size:  1 MB
 *
 *   Why WebP + PNG only?
 *   • WebP delivers ~30% smaller files than JPEG at equivalent quality.
 *     Smaller files → faster LCP → better Core Web Vitals → better Google ranking.
 *     For a medical blog, page speed is a direct SEO signal.
 *   • PNG covers lossless medical diagrams, infographics, and screenshots.
 *   • JPEG is rejected: lossy at all quality levels, no alpha channel, larger
 *     than WebP for equivalent visual quality.
 *   • GIF / SVG / HEIC / animated formats are not appropriate for featured images
 *     and carry unnecessary attack surface.
 *
 * PRACTICE / DOCTOR LOGOS   uploadLogo.single('logo')
 *   Accepted:  Any image/* except SVG (JPEG, PNG, WebP, GIF)
 *   Max size:  2 MB
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STORAGE STRATEGY
 *   Currently: diskStorage → backend/uploads/
 *
 *   TO MIGRATE TO S3 / CLOUDFLARE R2:
 *     1. npm install multer-s3 @aws-sdk/client-s3
 *     2. Replace `blogStorage` and `logoStorage` diskStorage instances below
 *        with multer-s3 storage adapters.
 *     3. Update `absoluteImageUrl()` in blogs.service.js to return CDN domain.
 *     No route or controller code needs to change.
 *
 * POST-UPLOAD COMPRESSION HOOK (future)
 *   After multer writes the file, blogs.service.updateImage() could call sharp:
 *     sharp(filePath)
 *       .resize({ width: 1200, withoutEnlargement: true })
 *       .webp({ quality: 82 })      // Re-encode PNG uploads to WebP
 *       .withMetadata(false)         // Strip EXIF (patient privacy)
 *       .toFile(optimisedPath)
 *   npm install sharp
 *   See: https://sharp.pixelplumbing.com/
 *
 * SECURITY
 *   • MIME type whitelist enforced by multer fileFilter BEFORE data hits disk
 *   • File extension derived from MIME type — never from the original filename
 *     (prevents "exploit.php" saved with a misleading extension)
 *   • Unique filenames: epoch-ms + 6-digit random → no enumeration, no overwrites
 *   • uploads/ directory auto-created at startup; not world-writable
 */

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const env    = require('../config/env');

// ── Upload directory ──────────────────────────────────────────────────────────
// Resolves to  <repo-root>/backend/uploads/
// Served as static assets in app.js:
//   app.use('/uploads', express.static(path.join(__dirname, '..', env.UPLOAD_DIR)))
const uploadDir = path.resolve(__dirname, '..', '..', env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── MIME → safe extension map ─────────────────────────────────────────────────
// Extension is always derived from MIME type — never from the original filename.
// A user cannot upload "payload.php" and have it saved as "payload.php.png".
const MIME_TO_EXT = {
  'image/webp': '.webp',
  'image/png':  '.png',
  'image/jpeg': '.jpg',
  'image/gif':  '.gif',
};

// ── Shared filename generator ─────────────────────────────────────────────────
const uniqueFilename = (_req, file, cb) => {
  const ext  = MIME_TO_EXT[file.mimetype] || '.bin';
  const rand = Math.round(Math.random() * 1e6).toString().padStart(6, '0');
  cb(null, `${Date.now()}-${rand}${ext}`);
};

// ── diskStorage instances ─────────────────────────────────────────────────────
const blogStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: uniqueFilename,
});

const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: uniqueFilename,
});

// ── Size constants ────────────────────────────────────────────────────────────
const BLOG_IMAGE_MAX_BYTES = 1 * 1024 * 1024;  // 1 MB — strict for SEO performance
const LOGO_MAX_BYTES       = 2 * 1024 * 1024;  // 2 MB — logos can be slightly larger

// ── MIME type filters ─────────────────────────────────────────────────────────

// Blog featured images: WebP and PNG only
const BLOG_IMAGE_MIMES = ['image/webp', 'image/png'];

const blogImageFilter = (_req, file, cb) => {
  if (BLOG_IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
  cb(
    Object.assign(
      new Error('Only WebP and PNG images are accepted. Convert your image free at squoosh.app'),
      { status: 415 }
    ),
    false
  );
};

// Practice logos: any common raster image (SVG excluded — XSS risk when inlined)
const logoFilter = (_req, file, cb) => {
  const isRasterImage = file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml';
  if (isRasterImage) return cb(null, true);
  cb(
    Object.assign(
      new Error('Only JPEG, PNG, and WebP images are allowed for logos.'),
      { status: 415 }
    ),
    false
  );
};

// ── Multer instances ──────────────────────────────────────────────────────────

/**
 * Blog featured image uploads.
 * Usage:   upload.single('image')
 * Formats: WebP, PNG only
 * Max:     1 MB
 */
const upload = multer({
  storage: blogStorage,
  fileFilter: blogImageFilter,
  limits: { fileSize: BLOG_IMAGE_MAX_BYTES },
});

/**
 * Practice / doctor logo uploads.
 * Usage:   uploadLogo.single('logo')
 * Formats: JPEG, PNG, WebP, GIF (no SVG)
 * Max:     2 MB
 */
const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: logoFilter,
  limits: { fileSize: LOGO_MAX_BYTES },
});

// ── Upload error → clean JSON ─────────────────────────────────────────────────
// Place this AFTER upload.single() / uploadLogo.single() in the middleware chain.
// Without this, multer errors fall through to Express's default HTML error page.
//
// Route usage example:
//   router.post('/:id/image', auth, upload.single('image'), handleUploadError, ctrl.uploadImage)
//
const handleUploadError = (err, _req, res, next) => {
  if (!err) return next();

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'Image must be under 1 MB.',
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected upload field. Expected field name: "image".',
    });
  }

  // Custom errors from fileFilter (we attach .status to the Error object above)
  return res.status(err.status || 400).json({
    success: false,
    message: err.message || 'File upload failed.',
  });
};

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = upload;                           // default — backward compatible
module.exports.upload            = upload;         // named — blog images
module.exports.uploadLogo        = uploadLogo;     // named — practice/doctor logos
module.exports.logoStorage       = logoStorage;    // named — raw storage instance
module.exports.handleUploadError = handleUploadError;
module.exports.BLOG_IMAGE_MAX_BYTES = BLOG_IMAGE_MAX_BYTES; // consumed by tests
