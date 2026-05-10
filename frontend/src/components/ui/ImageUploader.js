'use client';

/**
 * ImageUploader — reusable blog featured image picker
 *
 * Validates on selection (before any network request):
 *   • Format: WebP or PNG only
 *   • Size:   max 1 MB
 *
 * Props:
 *   currentUrl  — existing DB image path ("/uploads/xyz.webp") or null
 *   file        — currently selected File object (controlled, from parent state)
 *   error       — validation error string (controlled, from parent state)
 *   onChange    — (file: File|null, error: string|null) => void
 *                 Called on every selection or clear action.
 *   label       — section heading (default "Featured Image")
 */

import { PhotoIcon, XMarkIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

// ── Validation rules ──────────────────────────────────────────────────────────
// These must stay in sync with backend/src/utils/upload.js BLOG_IMAGE_MIMES
// and BLOG_IMAGE_MAX_BYTES. If you change them here, change them there too.
export const BLOG_IMAGE_ACCEPTED_TYPES  = ['image/webp', 'image/png'];
export const BLOG_IMAGE_MAX_MB          = 1;
export const BLOG_IMAGE_MAX_BYTES       = BLOG_IMAGE_MAX_MB * 1024 * 1024;

/**
 * Returns a human-readable error string, or null if the file is valid.
 * Called client-side on file selection for instant feedback.
 * The backend validates independently — this is UX, not the security boundary.
 */
export const validateBlogImage = (file) => {
  if (!BLOG_IMAGE_ACCEPTED_TYPES.includes(file.type)) {
    const ext = file.name.split('.').pop()?.toUpperCase() || 'unknown';
    return `"${ext}" files are not accepted. Use WebP or PNG.`;
  }
  if (file.size > BLOG_IMAGE_MAX_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(2);
    return `Image must be under ${BLOG_IMAGE_MAX_MB} MB. Your file is ${sizeMb} MB.`;
  }
  return null;
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageUploader({ currentUrl, file, error, onChange, label = 'Featured Image' }) {
  // Build preview URL:
  //   • Newly selected file  → blob: URL (instant, no upload needed for preview)
  //   • Existing DB image    → absolute API URL
  //   • Nothing selected     → null (show placeholder)
  const preview = file
    ? URL.createObjectURL(file)
    : currentUrl
    ? `${process.env.NEXT_PUBLIC_API_URL}${currentUrl}`
    : null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    // Reset the input value so the same file can be re-selected after clearing
    e.target.value = '';
    if (!selected) return;
    const validationError = validateBlogImage(selected);
    onChange(selected, validationError);
  };

  // Clear a newly-selected file (does not delete the existing DB image)
  const handleClearNewFile = () => {
    if (file) onChange(null, null);
  };

  return (
    <div className="space-y-3">

      {/* ── Header ── */}
      <div>
        <h2 className="font-semibold text-gray-900">{label}</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Displayed at the top of your published blog post and used as the social share preview image.
          A high-quality image improves click-through rate in search results.
        </p>
      </div>

      {/* ── Picker row ── */}
      <div className="flex items-start gap-4">

        {/* Preview / placeholder */}
        <div className="relative flex-shrink-0">
          {preview ? (
            <>
              <img
                src={preview}
                alt="Featured image preview"
                className="w-32 h-24 object-cover rounded-xl border border-gray-200 bg-gray-50"
              />
              {/* Only show the ✕ button when a NEW file is staged — not for the existing DB image */}
              {file && (
                <button
                  type="button"
                  onClick={handleClearNewFile}
                  title="Remove selected image"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white
                             flex items-center justify-center hover:bg-red-600 transition-colors shadow"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <div className="w-32 h-24 rounded-xl border-2 border-dashed border-gray-200
                            flex flex-col items-center justify-center bg-gray-50 gap-1.5">
              <PhotoIcon className="w-7 h-7 text-gray-300" />
              <span className="text-[10px] text-gray-300 font-medium tracking-wide">NO IMAGE</span>
            </div>
          )}
        </div>

        {/* Upload button + requirements + error */}
        <div className="space-y-2 min-w-0 flex-1">

          {/* Upload button */}
          <label
            className={[
              'btn-secondary cursor-pointer inline-flex items-center gap-2 text-sm',
              error ? 'border-red-300 text-red-600 hover:border-red-400 hover:text-red-700' : '',
            ].join(' ')}
          >
            <PhotoIcon className="w-4 h-4 flex-shrink-0" />
            {preview ? 'Change Image' : 'Upload Image'}
            <input
              type="file"
              // This tells the OS file picker to filter — users can still bypass it,
              // which is why we validate again in handleFileChange and on the backend.
              accept="image/webp,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {/* Format + size requirements — always visible, sets expectations upfront */}
          <div className="text-xs text-gray-500 leading-relaxed space-y-0.5">
            <p>
              <span className="font-medium text-gray-700">Accepted formats: </span>
              <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[11px]">WEBP</span>
              <span className="text-gray-400 text-[10px] ml-1">recommended</span>
              <span className="text-gray-300 mx-1.5">·</span>
              <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[11px]">PNG</span>
            </p>
            <p>
              <span className="font-medium text-gray-700">Max size: </span>
              1 MB
            </p>
          </div>

          {/* Validation feedback */}
          {error ? (
            <div className="flex items-start gap-1.5 text-xs text-red-600 font-medium">
              <ExclamationCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : file ? (
            <div className="flex items-center gap-1.5 text-xs text-green-700">
              <CheckCircleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate max-w-[180px]" title={file.name}>
                {file.name}
              </span>
              <span className="text-gray-400 flex-shrink-0">
                ({(file.size / 1024).toFixed(0)} KB)
              </span>
            </div>
          ) : null}

          {/* Conversion hint — shown only on format error */}
          {error && !error.includes('MB') && (
            <p className="text-xs text-gray-400">
              Convert free at{' '}
              <a
                href="https://squoosh.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline font-medium"
              >
                squoosh.app
              </a>
              {' '}or{' '}
              <a
                href="https://cloudconvert.com/jpg-to-webp"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline font-medium"
              >
                CloudConvert
              </a>
            </p>
          )}

          {/* Size-over hint — shown only on size error */}
          {error && error.includes('MB') && (
            <p className="text-xs text-gray-400">
              Compress at{' '}
              <a
                href="https://squoosh.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline font-medium"
              >
                squoosh.app
              </a>
              {' '}— WebP at quality 80 is typically under 200 KB.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
