import { supabaseAdmin, createAuthClient } from '../lib/supabaseAdmin.js'
import { dbError, forbidden, unauthorized } from '../common/errors.js'

/**
 * Verifies the Supabase-issued access token in `Authorization: Bearer
 * <token>`. Verification is delegated to Supabase Auth (auth.getUser), so it
 * works whichever signing scheme the project uses, without a JWT secret in
 * our env. A fresh client per request avoids Supabase's per-client auth lock
 * stalling concurrent requests from different users.
 *
 * Sets req.userId / req.userEmail / req.userMetadata. This is the auth
 * boundary for the whole API: everything after it trusts req.userId.
 *
 * @type {import('express').RequestHandler}
 */
export const authenticate = async (req, _res, next) => {
  const header = req.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw unauthorized('Missing Authorization header')

  const { data, error } = await createAuthClient().auth.getUser(token)
  if (error || !data?.user) throw unauthorized('Invalid or expired session, please log in again')

  req.userId = data.user.id
  req.userEmail = data.user.email ?? ''
  // Set by the client at signUp, so user-controlled: only ever used as
  // defaults for a brand-new profile (see routes/profile.js).
  req.userMetadata = data.user.user_metadata ?? {}
  next()
}

/**
 * Attaches req.profile (the caller's profiles row).
 * @type {import('express').RequestHandler}
 */
export const loadProfile = async (req, _res, next) => {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', req.userId).maybeSingle()
  if (error) throw dbError('load profile', error)
  if (!data) throw forbidden('Finish setting up your profile first')
  req.profile = data
  next()
}

/**
 * Must run after loadProfile.
 * @type {import('express').RequestHandler}
 */
export const requireSeller = (req, _res, next) => {
  if (!req.profile?.is_seller) throw forbidden('Seller account required')
  next()
}

/** authenticate + loadProfile + requireSeller, the guard for seller-only routes. */
export const sellerOnly = [authenticate, loadProfile, requireSeller]
