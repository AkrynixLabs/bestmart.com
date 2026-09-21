import { z } from 'zod'
import { Id, Uuid } from './common.js'

export const MAX_MESSAGE_LENGTH = 2000

export const ConversationCreate = z.object({
  sellerId: Uuid.refine(Boolean, 'sellerId is required'),
})

export const MessageCreate = z.object({
  body: z
    .string({ message: 'Message body is required' })
    .trim()
    .min(1, 'Message body is required')
    .max(MAX_MESSAGE_LENGTH, `Messages can be at most ${MAX_MESSAGE_LENGTH} characters`),
  // Only used to look up the real product name server-side.
  productId: Id.optional().catch(undefined),
})

export const ConversationParams = z.object({ id: Id })
