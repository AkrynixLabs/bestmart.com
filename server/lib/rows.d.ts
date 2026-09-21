// Row shapes of the Supabase tables the API reads, as returned by PostgREST.
// Mirrors supabase/migrations/*.sql — update both together. (`numeric`
// columns arrive as JS numbers or strings depending on size, hence the union.)

type Numeric = number | string

export interface ProfileRow {
  id: string
  name: string
  email: string
  is_seller: boolean
  business_name: string | null
  business_category: string | null
  business_address: string | null
  store_description: string | null
  business_logo: string | null
  phone: string | null
  created_at: string
}

export interface ProductRow {
  id: number
  seller_id: string | null
  seller: string
  name: string
  category: string
  price: Numeric
  old_price: Numeric | null
  images: string[]
  rating: Numeric | null
  is_new: boolean
  best_seller: boolean
  created_at: string
}

export interface ProductSnapshot {
  id: number
  name: string
  category: string
  price: number
  oldPrice?: number
  seller: string
  sellerId: string | null
  images: string[]
  sellerAdded?: boolean
}

export interface CartItemRow {
  id: number
  user_id: string
  product_id: number
  product_snapshot: ProductSnapshot
  qty: number
  created_at: string
}

export interface OrderRow {
  id: number
  user_id: string
  total: Numeric
  status: string
  created_at: string
}

export interface OrderItemRow {
  id: number
  order_id: number
  product_id: number
  seller_id: string | null
  buyer_id: string | null
  price: Numeric
  qty: number
  snapshot: ProductSnapshot
  created_at: string
}

export interface ConversationRow {
  id: number
  buyer_id: string
  seller_id: string
  last_message_at: string
  buyer_last_read_at: string
  seller_last_read_at: string
  created_at: string
}

export interface MessageRow {
  id: number
  conversation_id: number
  sender_id: string
  body: string
  product_id: number | null
  product_name: string | null
  created_at: string
}
