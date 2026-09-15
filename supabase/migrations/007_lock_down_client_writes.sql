-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- for your bestmart project, after 001-006.
--
-- Since the Express API (server/) took over every data read/write, the
-- browser only talks to Supabase directly for Auth and for Realtime
-- subscriptions on `conversations` and `messages`. But the original
-- client-era RLS policies still let any signed-in user write those tables
-- directly with the public anon key — skipping every check the API makes
-- (server-side prices at checkout, seller verification, input validation,
-- etc.). For example, a buyer could insert a cart row or order with any
-- price, or set their own profile's is_seller flag.
--
-- The API uses the service-role key, which bypasses RLS, so removing these
-- policies changes nothing for the app — it only closes the direct path.
-- Kept: the SELECT policies Realtime relies on to decide which change
-- events a user may receive, and public read access to products/images.

-- profiles: no direct client access needed at all.
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;

-- products: public read stays; writes only through the API.
drop policy if exists "Sellers manage their own products" on public.products;

-- cart_items: API only.
drop policy if exists "Users manage their own cart" on public.cart_items;

-- orders / order_items: API only for writes.
drop policy if exists "Buyers create their own orders" on public.orders;
drop policy if exists "Sellers update status of orders containing their items" on public.orders;
drop policy if exists "Buyers create order items on their own orders" on public.order_items;

-- conversations / messages: SELECT policies stay (Realtime needs them);
-- writes only through the API.
drop policy if exists "Participants create their own conversations" on public.conversations;
drop policy if exists "Participants update their own conversations" on public.conversations;
drop policy if exists "Participants send messages in their conversations" on public.messages;

-- Storage: uploads go through POST /api/products/images and
-- POST /api/profile/logo; public read stays.
drop policy if exists "Sellers manage their own product image files" on storage.objects;
