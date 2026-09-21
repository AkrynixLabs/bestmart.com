import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabaseAdmin.js'
import { badRequest, dbError } from '../common/errors.js'

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024
/** @type {Record<string, string>} */
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const BUCKET = 'product-images'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, Boolean(IMAGE_EXTENSIONS[file.mimetype])),
})

/**
 * Runs multer and turns its errors (file too large, extra files) into a 400.
 * @type {import('express').RequestHandler}
 */
const parseSingleImage = (req, res, next) => {
  upload.single('file')(req, res, (/** @type {unknown} */ err) => {
    if (!err) return next()
    const code = err instanceof multer.MulterError ? err.code : undefined
    next(badRequest(code === 'LIMIT_FILE_SIZE' ? 'Each image must be under 3MB' : 'Upload one image file'))
  })
}

/**
 * Stores the uploaded file in the public bucket under the caller's own
 * folder with a server-chosen name (the client's filename is never used),
 * responding { url }.
 * @type {import('express').RequestHandler}
 */
const storeImage = async (req, res) => {
  if (!req.file) throw badRequest('Upload a JPG, PNG, WebP or GIF image')
  const path = `${req.userId}/${randomUUID()}.${IMAGE_EXTENSIONS[req.file.mimetype]}`
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, req.file.buffer, { contentType: req.file.mimetype })
  if (error) throw dbError('upload image', error)
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  res.status(201).json({ url: data.publicUrl })
}

/** Must run after `authenticate` (needs req.userId). */
export const handleImageUpload = [parseSingleImage, storeImage]
