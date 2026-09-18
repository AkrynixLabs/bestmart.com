import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../lib/apiClient'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export const MAX_QTY = 99

export function CartProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const result = await api.get('/cart')
    if (result.ok) setItems(result.data)
    return result
  }, [])

  useEffect(() => {
    if (!userId) {
      setItems([])
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    api.get('/cart').then((result) => {
      if (!active) return
      if (result.ok) setItems(result.data)
      setLoading(false)
    })

    return () => {
      active = false
    }
    // Keyed on the user's id, not the user object — a profile edit replaces
    // the object but shouldn't refetch the cart.
  }, [userId])

  const addToCart = async (product) => {
    if (!user) return { ok: false, error: 'Not signed in' }

    // Only the id is sent — the server builds the cart line (price, seller)
    // from the real product.
    const result = await api.post('/cart', { productId: product.id })
    if (!result.ok) return result

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      return existing
        ? prev.map((item) => (item.id === product.id ? result.data : item))
        : [...prev, result.data]
    })
    return { ok: true }
  }

  const removeFromCart = async (id) => {
    if (!user) return { ok: false, error: 'Not signed in' }
    const result = await api.delete(`/cart/${id}`)
    if (result.ok) setItems((prev) => prev.filter((item) => item.id !== id))
    return result
  }

  const updateQty = async (id, qty) => {
    if (!user || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { ok: false }
    const result = await api.patch(`/cart/${id}`, { qty })
    if (result.ok) setItems((prev) => prev.map((item) => (item.id === id ? { ...item, qty } : item)))
    return result
  }

  const count = items.reduce((sum, item) => sum + item.qty, 0)
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0)

  // Turns the current cart into a real order via POST /api/checkout. The
  // server re-prices every line from the live product; if some items were
  // removed from the shop it drops them and returns an error, so the cart
  // is reloaded to show what's actually left.
  const checkout = async () => {
    if (!user || items.length === 0) return { ok: false, error: 'Your cart is empty' }

    const result = await api.post('/checkout')
    if (!result.ok) {
      await refresh()
      return result
    }

    setItems([])
    return { ok: true, order: result.data }
  }

  const value = { items, loading, addToCart, removeFromCart, updateQty, count, total, checkout }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
