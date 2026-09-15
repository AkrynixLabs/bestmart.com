import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { asyncHandler } from '../lib/asyncHandler.js'
import { lookupProduct, parseProductId } from '../lib/catalog.js'

const MAX_MESSAGE_LENGTH = 2000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const router = Router()
router.use(authenticate)

// conversations row -> the shape the frontend works with, from this
// viewer's point of view.
function shapeConversation(row, userId, nameMap, preview) {
  const isBuyer = row.buyer_id === userId
  const otherId = isBuyer ? row.seller_id : row.buyer_id
  const otherProfile = nameMap?.[otherId]
  const otherName = isBuyer
    ? otherProfile?.business_name || otherProfile?.name || 'Seller'
    : otherProfile?.name || 'Buyer'
  const myReadAt = isBuyer ? row.buyer_last_read_at : row.seller_last_read_at
  return {
    id: row.id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    otherId,
    isBuyer,
    otherName,
    lastMessageAt: row.last_message_at,
    unread: new Date(row.last_message_at) > new Date(myReadAt),
    preview: preview || '',
  }
}

// Server-side, there's no need for the get_conversation_partner_names RPC
// the client uses (that existed to work around the client's own restricted
// RLS access to `profiles`) — the service-role key already sees every row.
async function loadConversationsForUser(userId) {
  const { data: rows, error } = await supabaseAdmin
    .from('conversations')
    .select('id, buyer_id, seller_id, last_message_at, buyer_last_read_at, seller_last_read_at')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('last_message_at', { ascending: false })
  if (error) throw error

  const otherIds = [...new Set((rows ?? []).map((r) => (r.buyer_id === userId ? r.seller_id : r.buyer_id)))]
  const nameMap = {}
  if (otherIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name, business_name').in('id', otherIds)
    for (const p of profiles ?? []) nameMap[p.id] = p
  }

  const ids = (rows ?? []).map((r) => r.id)
  const previews = {}
  if (ids.length > 0) {
    const { data: msgRows } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
    for (const m of msgRows ?? []) {
      if (!previews[m.conversation_id]) previews[m.conversation_id] = m.body
    }
  }

  return (rows ?? []).map((r) => shapeConversation(r, userId, nameMap, previews[r.id]))
}

// GET /api/conversations
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await loadConversationsForUser(req.userId))
  })
)

// POST /api/conversations — find-or-create the thread with a seller.
// body: { sellerId }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const sellerId = req.body.sellerId
    if (typeof sellerId !== 'string' || !UUID_RE.test(sellerId)) {
      return res.status(400).json({ error: 'sellerId is required' })
    }
    if (sellerId === req.userId) return res.status(400).json({ error: "Can't message yourself" })

    const { data: seller, error: sellerError } = await supabaseAdmin
      .from('profiles')
      .select('id, is_seller')
      .eq('id', sellerId)
      .maybeSingle()
    if (sellerError) return res.status(500).json({ error: sellerError.message })
    if (!seller?.is_seller) return res.status(404).json({ error: 'Seller not found' })

    const { data, error } = await supabaseAdmin
      .from('conversations')
      .upsert({ buyer_id: req.userId, seller_id: sellerId }, { onConflict: 'buyer_id,seller_id' })
      .select('id')
      .single()
    if (error) return res.status(400).json({ error: error.message })

    const conversations = await loadConversationsForUser(req.userId)
    res.status(201).json(conversations.find((c) => c.id === data.id))
  })
)

// Every /:id route below requires the caller to be a participant.
const requireParticipant = asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(404).json({ error: 'Conversation not found' })
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, buyer_id, seller_id, buyer_last_read_at, seller_last_read_at')
    .eq('id', id)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data || (data.buyer_id !== req.userId && data.seller_id !== req.userId)) {
    return res.status(404).json({ error: 'Conversation not found' })
  }
  req.conversation = data
  next()
})

// GET /api/conversations/:id/messages
router.get(
  '/:id/messages',
  requireParticipant,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', req.conversation.id)
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    res.json(data ?? [])
  })
)

// POST /api/conversations/:id/messages — body: { body, productId?, productName? }
// This INSERT lands in the same table the client's Realtime subscription
// watches, so live delivery keeps working without the client needing to
// write here directly.
router.post(
  '/:id/messages',
  requireParticipant,
  asyncHandler(async (req, res) => {
    const text = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (!text) return res.status(400).json({ error: 'Message body is required' })
    if (text.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters` })
    }

    // The "Re: <product>" label comes from the real product, not the client.
    const productId = parseProductId(req.body?.productId)
    const product = productId ? await lookupProduct(productId) : null

    const isBuyer = req.conversation.buyer_id === req.userId
    const payload = {
      conversation_id: req.conversation.id,
      sender_id: req.userId,
      body: text,
      ...(product ? { product_id: product.id, product_name: product.name } : {}),
    }
    const { data: message, error } = await supabaseAdmin.from('messages').insert(payload).select().single()
    if (error) return res.status(400).json({ error: error.message })

    const column = isBuyer ? 'buyer_last_read_at' : 'seller_last_read_at'
    const now = new Date().toISOString()
    await supabaseAdmin
      .from('conversations')
      .update({ last_message_at: now, [column]: now })
      .eq('id', req.conversation.id)

    res.status(201).json(message)
  })
)

// PATCH /api/conversations/:id/read
router.patch(
  '/:id/read',
  requireParticipant,
  asyncHandler(async (req, res) => {
    const isBuyer = req.conversation.buyer_id === req.userId
    const column = isBuyer ? 'buyer_last_read_at' : 'seller_last_read_at'
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({ [column]: new Date().toISOString() })
      .eq('id', req.conversation.id)
    if (error) return res.status(400).json({ error: error.message })
    res.json({ ok: true })
  })
)

export default router
