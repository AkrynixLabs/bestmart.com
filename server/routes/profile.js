import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { handleImageUpload, isHttpsUrl } from '../lib/imageUpload.js'

const router = Router()
router.use(authenticate)

// Editable text fields: API (camelCase) -> profiles column, with a max
// length. `email` is deliberately absent — it's owned by Supabase Auth and
// always written from the verified token, so a user can't display someone
// else's address. `isSeller` is handled separately below.
const TEXT_FIELDS = {
  name: ['name', 100],
  businessName: ['business_name', 120],
  businessCategory: ['business_category', 60],
  businessAddress: ['business_address', 200],
  storeDescription: ['store_description', 1000],
  businessLogo: ['business_logo', 2048],
  phone: ['phone', 30],
}

function validateProfileBody(body) {
  const row = {}
  for (const [key, [column, maxLength]] of Object.entries(TEXT_FIELDS)) {
    if (body[key] === undefined) continue
    if (body[key] === null) {
      row[column] = null
      continue
    }
    if (typeof body[key] !== 'string') return { error: `${key} must be text` }
    const value = body[key].trim()
    if (value.length > maxLength) return { error: `${key} must be at most ${maxLength} characters` }
    row[column] = value || null
  }
  if ('name' in row && !row.name) return { error: 'Name is required' }
  if (row.business_logo && !isHttpsUrl(row.business_logo)) return { error: 'Upload the logo image first' }

  if (body.isSeller !== undefined) {
    if (typeof body.isSeller !== 'boolean') return { error: 'isSeller must be true or false' }
    row.is_seller = body.isSeller
  }
  return { row }
}

function rowToUser(row) {
  if (!row) return null
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

const defaultName = (email) => (email || 'user').split('@')[0]

const metadataText = (value, maxLength) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : null

// The first profile row for an account, using what the signup form stored
// in user_metadata (see AuthContext.registerAccount) when available.
function initialProfileRow(req) {
  const meta = req.userMetadata || {}
  return {
    id: req.userId,
    email: req.userEmail,
    name: metadataText(meta.name, 100) || defaultName(req.userEmail),
    business_name: metadataText(meta.businessName, 120),
    is_seller: meta.isSeller === true,
  }
}

async function findProfile(userId) {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

// GET /api/profile — fetch own profile. Auto-creates a minimal default row
// if one doesn't exist yet (first login after an email-confirm signup, when
// no session existed at signup time to create it). Upsert with
// ignoreDuplicates makes a race with a concurrent signup PATCH harmless: if
// the PATCH's real values land first, they are kept, not overwritten.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    let profile = await findProfile(req.userId)
    if (!profile) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .upsert(initialProfileRow(req), { onConflict: 'id', ignoreDuplicates: true })
      if (error) return res.status(500).json({ error: error.message })
      profile = await findProfile(req.userId)
    }
    res.json(rowToUser(profile))
  })
)

// PATCH /api/profile — create-or-update own profile in one call. Signup
// calls this directly with the submitted values; Settings/Profile call it
// for partial edits.
router.patch(
  '/',
  asyncHandler(async (req, res) => {
    const { row, error: validationError } = validateProfileBody(req.body ?? {})
    if (validationError) return res.status(400).json({ error: validationError })

    const existing = await findProfile(req.userId)
    const fullRow = {
      // Defaults only matter when the row doesn't exist yet (name is NOT NULL).
      ...(existing ? {} : initialProfileRow(req)),
      ...row,
      id: req.userId,
      email: req.userEmail,
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .upsert(fullRow, { onConflict: 'id' })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(rowToUser(data))
  })
)

// POST /api/profile/logo — multipart `file`. Stores the image and returns
// { url }; the client then saves that URL via PATCH /api/profile. Keeps
// multi-megabyte images out of JSON bodies (express.json() caps at 100KB).
router.post('/logo', ...handleImageUpload)

export default router
