import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { handleImageUpload } from '../lib/imageUpload.js'
import { validate } from '../common/validate.js'
import { dbError } from '../common/errors.js'
import { rateLimit } from '../common/rateLimit.js'
import { ProfileUpdate } from '../../shared/schemas/profile.js'

/** @typedef {import('../lib/rows.js').ProfileRow} ProfileRow */

const router = Router()
router.use(authenticate)

/** @param {ProfileRow} row */
function rowToUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isSeller: row.is_seller ?? false,
    businessName: row.business_name || undefined,
    businessCategory: row.business_category || undefined,
    businessAddress: row.business_address || undefined,
    storeDescription: row.store_description || undefined,
    businessLogo: row.business_logo || undefined,
    phone: row.phone || undefined,
  }
}

/** API field -> profiles column, for the editable fields. */
const COLUMNS = /** @type {const} */ ({
  name: 'name',
  businessName: 'business_name',
  businessCategory: 'business_category',
  businessAddress: 'business_address',
  storeDescription: 'store_description',
  businessLogo: 'business_logo',
  phone: 'phone',
  isSeller: 'is_seller',
})

/** @param {import('../../shared/schemas/profile.js').ProfileUpdateInput} input */
function inputToRow(input) {
  /** @type {Record<string, unknown>} */
  const row = {}
  for (const [field, column] of Object.entries(COLUMNS)) {
    const value = input[/** @type {keyof typeof COLUMNS} */ (field)]
    if (value !== undefined) row[column] = value
  }
  return row
}

/** @param {string} email */
const defaultName = (email) => (email || 'user').split('@')[0]

/** @param {unknown} value @param {number} maxLength */
const metadataText = (value, maxLength) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null

/**
 * The first profile row for an account, from what the signup form stored in
 * user_metadata (see AuthContext.registerAccount) when available.
 * @param {import('express').Request} req
 */
function initialProfileRow(req) {
  const meta = req.userMetadata
  return {
    id: req.userId,
    email: req.userEmail,
    name: metadataText(meta.name, 100) || defaultName(req.userEmail),
    business_name: metadataText(meta.businessName, 120),
    is_seller: meta.isSeller === true,
  }
}

/** @param {string} userId @returns {Promise<ProfileRow | null>} */
async function findProfile(userId) {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw dbError('find profile', error)
  return data
}

// GET /api/profile — own profile. Creates a default row on first login
// after an email-confirmed signup. ignoreDuplicates makes a race with a
// concurrent signup PATCH harmless (the PATCH's real values are kept).
router.get('/', async (req, res) => {
  let profile = await findProfile(req.userId)
  if (!profile) {
    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(initialProfileRow(req), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw dbError('create profile', error)
    profile = await findProfile(req.userId)
  }
  if (!profile) throw dbError('create profile', 'row missing after upsert')
  res.json(rowToUser(profile))
})

// PATCH /api/profile — create-or-update own profile. Email is always taken
// from the verified token, never from the body.
router.patch('/', validate(ProfileUpdate), async (req, res) => {
  const row = inputToRow(req.body)
  const existing = await findProfile(req.userId)
  const fullRow = {
    ...(existing ? {} : initialProfileRow(req)),
    ...row,
    id: req.userId,
    email: req.userEmail,
  }
  const { data, error } = await supabaseAdmin.from('profiles').upsert(fullRow, { onConflict: 'id' }).select().single()
  if (error) throw dbError('save profile', error)
  res.json(rowToUser(data))
})

// POST /api/profile/logo — multipart `file`; returns { url } to save via
// PATCH. Keeps images out of JSON bodies (capped at 100KB).
router.post(
  '/logo',
  rateLimit({ name: 'profile-logo', limit: 20, windowMs: 10 * 60_000 }),
  ...handleImageUpload
)

export default router
