const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');

// Ensure upload dir exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Storage interface – swap this for Cloudinary/S3 adapter later.
 * All adapters must implement: save(buffer, mime, ext) -> { filePath, url }
 *                               delete(filePath) -> void
 *                               getUrl(filePath) -> string
 */

const localAdapter = {
  async save(buffer, mime, originalExt) {
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = sanitizeExt(originalExt);
    const fileName = `${randomName}${ext}`;
    const fullPath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(fullPath, buffer);
    return { filePath: fileName, url: `/api/attachments/file/${fileName}` };
  },

  async delete(filePath) {
    const fullPath = path.join(UPLOAD_DIR, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  },

  getFullPath(filePath) {
    return path.join(UPLOAD_DIR, filePath);
  },
};

function sanitizeExt(ext) {
  if (!ext) return '';
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  return allowed.includes(clean) ? `.${clean}` : '';
}

module.exports = localAdapter;
