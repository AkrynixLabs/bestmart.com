import { z } from 'zod'
import { Id } from './common.js'

export const OrderParams = z.object({ id: Id })
