import { useState, useEffect } from 'react'

function readList(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    const parsed = saved ? JSON.parse(saved) : null
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    // Corrupt JSON or storage blocked (private mode) — start fresh rather
    // than crash the page.
    return fallback
  }
}

/**
 * A useState-shaped array that persists itself to localStorage under `key`.
 * Used by the dashboard's Ads page. If `key` changes (e.g. a different
 * seller signs in on the same browser), the list reloads from the new key.
 */
export function useLocalStorageList(key, initialValue = []) {
  const [state, setState] = useState(() => ({ key, items: readList(key, initialValue) }))

  // Reload synchronously during render when the key changes, so the old
  // key's list is never written into the new key.
  let current = state
  if (state.key !== key) {
    current = { key, items: readList(key, initialValue) }
    setState(current)
  }

  useEffect(() => {
    try {
      localStorage.setItem(current.key, JSON.stringify(current.items))
    } catch {
      // Storage full or blocked — keep working in memory.
    }
  }, [current.key, current.items])

  const setItems = (update) =>
    setState((prev) => ({ ...prev, items: typeof update === 'function' ? update(prev.items) : update }))

  return [current.items, setItems]
}
