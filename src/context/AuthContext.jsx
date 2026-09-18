import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { api } from '../lib/apiClient'

const AuthContext = createContext(null)

// Auth itself (signUp/signInWithPassword/signOut/session) stays direct to
// Supabase — it already hashes passwords and issues real JWTs, no reason
// to reinvent that. Everything about the `profiles` table goes through the
// new Express API instead (see server/routes/profile.js), which does its
// own row<->camelCase mapping server-side now — this file just sends/reads
// plain camelCase objects.

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    // Only the newest auth event's profile response may update state — an
    // older, slower response must not overwrite a newer one.
    let latest = 0

    // The listener fires INITIAL_SESSION right away (restoring a saved
    // session on page load), then keeps state in sync on sign-in/out —
    // including a logout in another tab. So no separate getSession() call.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const request = ++latest
      if (!session?.user) {
        setUser(null)
        setLoading(false)
        return
      }
      // Deferred out of the callback: Supabase holds its auth lock while
      // listeners run, so awaiting work inside one can deadlock.
      setTimeout(async () => {
        const result = await api.get('/profile', { token: session.access_token })
        if (!active || request !== latest) return
        if (result.ok) setUser(result.data)
        setLoading(false)
      }, 0)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  // Used by Signup and SellerSignup: creates a real Supabase Auth account
  // (hashed password, handled entirely by Supabase — never touches our
  // code) plus a matching row in `profiles` via the API for everything else.
  const registerAccount = async ({ password, ...profile }) => {
    // The profile fields also ride along as user_metadata: if this project
    // requires email confirmation there's no session yet to call the
    // profile API with, and the server builds the profile from this
    // metadata on first login instead (server/routes/profile.js) — so a
    // seller's shop name isn't lost along the way.
    const { data, error } = await supabase.auth.signUp({
      email: profile.email,
      password,
      options: {
        data: { name: profile.name, businessName: profile.businessName, isSeller: Boolean(profile.isSeller) },
      },
    })
    if (error) return { ok: false, error: error.message }

    if (!data.session) {
      return {
        ok: false,
        needsConfirmation: true,
        error: 'Almost there! Check your email to confirm your account, then log in.',
      }
    }

    // Passing the token straight from signUp()'s own response, rather than
    // letting this call fetch it via getSession() itself — that call would
    // race the auth-state-change listener above (it fires the instant
    // signUp() returns a session, calling getSession() itself), which was
    // unreliable in testing. PATCH is an upsert server-side (see
    // server/routes/profile.js) — it creates the row if the listener's own
    // concurrent fetch hasn't already, or updates it if it has, in one
    // round trip either way, with the real values from the signup form.
    const token = data.session.access_token
    const result = await api.patch('/profile', profile, { token })
    if (!result.ok) return result

    setUser(result.data)
    return { ok: true }
  }

  // Used by Login: real Supabase credential check (bcrypt-hashed
  // comparison server-side, not our code) instead of a hand-rolled one.
  const authenticate = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, error: error.message }

    // Same reasoning as registerAccount — use the token signInWithPassword
    // already gave us instead of a second, potentially-stalled getSession().
    const token = data.session.access_token

    // GET auto-creates a minimal default profile if one doesn't exist yet
    // (first login after confirming an email-verified signup, where no
    // session existed at signup time to create it then).
    const result = await api.get('/profile', { token })
    if (!result.ok) return result

    setUser(result.data)
    return { ok: true }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const updateUser = async (updates) => {
    if (!user) return { ok: false, error: 'Not signed in' }

    const result = await api.patch('/profile', updates)
    if (!result.ok) return result

    setUser(result.data)
    return { ok: true }
  }

  const value = { user, isAuthenticated: Boolean(user), loading, registerAccount, authenticate, logout, updateUser }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
