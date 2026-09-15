import multer from 'multer'
import { randomUUID } from 'crypto'
import { supabaseAdmin } from './supabaseAdmin.js'
import { asyncHandler } from './asyncHandler.js'

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => cb(null, Boolean(IMAGE_EXTENSIONS[file.mimetype])),
})

// Runs multer and turns its errors (e.g. file too large) into a 400 instead
// of a generic 500.
function parseSingleImage(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be under 3MB' : err.message
    res.status(400).json({ error: message })
  })
}

/**
 * Middleware pair that accepts one multipart `file` field and stores it in
 * the public `product-images` bucket under the caller's own folder,
 * responding { url }. Must run after `authenticate` (needs req.userId).
 * The client's filename is never used in the storage path.
 */
export const handleImageUpload = [
  parseSingleImage,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Upload a JPG, PNG, WebP or GIF image' })
    const path = `${req.userId}/${randomUUID()}.${IMAGE_EXTENSIONS[req.file.mimetype]}`
    const { error } = await supabaseAdmin.storage
      .from('product-images')
      .upload(path, req.file.buffer, { contentType: req.file.mimetype })
    if (error) return res.status(400).json({ error: error.message })
    const { data } = supabaseAdmin.storage.from('product-images').getPublicUrl(path)
    res.status(201).json({ url: data.publicUrl })
  }),
]

export const isHttpsUrl = (value) => typeof value === 'string' && value.startsWith('https://') && value.length < 2048
