import { Router } from 'express'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { authenticate } from '../middleware/auth.js'
import { lookupProduct } from '../lib/catalog.js'
import { validate } from '../common/validate.js'
import { badRequest, dbError, notFound } from '../common/errors.js'
import { rateLimit } from '../common/rateLimit.js'
import { ConversationCreate, ConversationParams, MessageCreate } from '../../shared/schemas/messaging.js'

/** @typedef {import('../lib/rows.js').ConversationRow} ConversationRow */
/** @typedef {{ id: string, name: string, business_name: string | null }} PartnerProfile */

const router = Router()
router.use(authenticate)

/**
 * conversations row -> the frontend shape, from this viewer's point of view.
 * @param {ConversationRow} row
 * @param {string} userId
 * @param {Map<string, PartnerProfile>} names
 * @param {string | undefined} preview
 */
function shapeConversation(row, userId, names, preview) {
  const isBuyer = row.buyer_id === userId
  const otherId = isBuyer ? row.seller_id : row.buyer_id
  const other = names.get(otherId)
  const otherName = isBuyer ? other?.business_name || other?.name || 'Seller' : other?.name || 'Buyer'
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

/**
 * Latest message body per conversation. One small indexed query per thread
 * (limit 1) instead of downloading every message of every thread.
 * @param {number[]} conversationIds
 * @returns {Promise<Map<number, string>>}
 */
async function latestPreviews(conversationIds) {
  const results = await Promise.all(
    conversationIds.map((id) =>
      supabaseAdmin
        .from('messages')
        .select('body')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw dbError('load message preview', error)
          return /** @type {[number, string]} */ ([id, data?.body ?? ''])
        })
    )
  )
  return new Map(results)
}

/** @param {string} userId */
async function loadConversationsForUser(userId) {
  // userId comes from the verified token (a UUID), never from the client,
  // so interpolating it into the PostgREST filter is safe.
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('last_message_at', { ascending: false })
  if (error) throw dbError('list conversations', error)
  const rows = /** @type {ConversationRow[]} */ (data ?? [])

  const otherIds = [...new Set(rows.map((r) => (r.buyer_id === userId ? r.seller_id : r.buyer_id)))]
  /** @type {Map<string, PartnerProfile>} */
  const names = new Map()
  if (otherIds.length > 0) {
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, business_name')
      .in('id', otherIds)
    if (profileError) throw dbError('load conversation partners', profileError)
    for (const p of profiles ?? []) names.set(p.id, p)
  }

  const previews = await latestPreviews(rows.map((r) => r.id))
  return rows.map((r) => shapeConversation(r, userId, names, previews.get(r.id)))
}

// GET /api/conversations
router.get('/', async (req, res) => {
  res.json(await loadConversationsForUser(req.userId))
})

// POST /api/conversations — find-or-create the thread with a seller.
router.post('/', validate(ConversationCreate), async (req, res) => {
  const { sellerId } = req.body
  if (sellerId === req.userId) throw badRequest("You can't message yourself")

  const { data: seller, error: sellerError } = await supabaseAdmin
    .from('profiles')
    .select('id, is_seller')
    .eq('id', sellerId)
    .maybeSingle()
  if (sellerError) throw dbError('look up seller', sellerError)
  if (!seller?.is_seller) throw notFound('Seller not found')

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .upsert({ buyer_id: req.userId, seller_id: sellerId }, { onConflict: 'buyer_id,seller_id' })
    .select('id')
    .single()
  if (error) throw dbError('open conversation', error)

  const conversations = await loadConversationsForUser(req.userId)
  res.status(201).json(conversations.find((c) => c.id === data.id))
})

/**
 * Every /:id route requires the caller to be a participant. Non-participants
 * get 404 (not 403) so thread ids can't be probed.
 * @type {import('express').RequestHandler}
 */
const requireParticipant = async (req, _res, next) => {
  const { id } = /** @type {{ id: number }} */ (/** @type {unknown} */ (req.params))
  const { data, error } = await supabaseAdmin.from('conversations').select('*').eq('id', id).maybeSingle()
  if (error) throw dbError('load conversation', error)
  if (!data || (data.buyer_id !== req.userId && data.seller_id !== req.userId)) {
    throw notFound('Conversation not found')
  }
  req.conversation = data
  next()
}

const participant = [validate(ConversationParams, 'params'), requireParticipant]

// GET /api/conversations/:id/messages
router.get('/:id/messages', ...participant, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', req.conversation.id)
    .order('created_at', { ascending: true })
  if (error) throw dbError('load messages', error)
  res.json(data ?? [])
})

// POST /api/conversations/:id/messages — { body, productId? }. The insert
// lands in the table the client's Realtime subscription watches.
router.post(
  '/:id/messages',
  rateLimit({ name: 'messages', limit: 30, windowMs: 60_000 }),
  ...participant,
  validate(MessageCreate),
  async (req, res) => {
    const { body, productId } = req.body
    // The "Re: <product>" label comes from the real product, not the client.
    const product = productId ? await lookupProduct(productId) : null

    const isBuyer = req.conversation.buyer_id === req.userId
    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: req.conversation.id,
        sender_id: req.userId,
        body,
        ...(product ? { product_id: product.id, product_name: product.name } : {}),
      })
      .select()
      .single()
    if (error) throw dbError('send message', error)

    const now = new Date().toISOString()
    const { error: touchError } = await supabaseAdmin
      .from('conversations')
      .update({ last_message_at: now, [isBuyer ? 'buyer_last_read_at' : 'seller_last_read_at']: now })
      .eq('id', req.conversation.id)
    if (touchError) throw dbError('update conversation timestamps', touchError)

    res.status(201).json(message)
  }
)

// PATCH /api/conversations/:id/read
router.patch('/:id/read', ...participant, async (req, res) => {
  const isBuyer = req.conversation.buyer_id === req.userId
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ [isBuyer ? 'buyer_last_read_at' : 'seller_last_read_at']: new Date().toISOString() })
    .eq('id', req.conversation.id)
  if (error) throw dbError('mark conversation read', error)
  res.json({ ok: true })
})

export default router
