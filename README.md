# BestMart

BestMart is a full-stack, Ghana-based multi-vendor marketplace: a **React 19** + **Vite** + **Tailwind CSS v4** + **React Router v7** front end, an **Express 5** API, and **Supabase** (Postgres, Auth, Storage, Realtime). It lets everyday shoppers browse and buy products from independent sellers, and lets those sellers sign in to a dashboard to publish, advertise, and manage what they sell — matching the platform's tagline: **Publish · Advertise · Sell**.

This project was built as part of the **WomenTechsters** program to demonstrate practical engineering skills: component architecture, a server-side API with real authorization, authenticated vs. public routing, shared layout ("Wrapper") components, global state via Context, responsive design, form handling and validation, and a cohesive brand-driven design system.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [Layouts ("Wrapper" components)](#layouts-wrapper-components)
- [Authentication & Protected Routes](#authentication--protected-routes)
- [Routing](#routing)
- [Cart & Shop](#cart--shop)
- [Shared Components](#shared-components)
- [Design System](#design-system)
- [Form Handling & Validation](#form-handling--validation)
- [Component Lifecycle: State, Mounting, and Re-renders](#component-lifecycle-state-mounting-and-re-renders)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Responsive Behavior](#responsive-behavior)
- [Project Decisions & Rationale](#project-decisions--rationale)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Author](#author)

---

## Overview

BestMart has two faces:

1. **The storefront** (public) — Shop (the home page), Cart, About, Contact, Login, Signup. Anyone can browse; adding to the cart and checking out require a free account. Signed-in shoppers also get a Profile with order history and Messages to chat with sellers.
2. **The seller dashboard** (signed in **and** registered as a seller via `/sell`) — Dashboard, My Products, Advertise, Orders, Settings, presented behind a sidebar navigation instead of the public navbar/footer.

Both faces share one design system, one routing table, and one set of reusable form/UI components — but each is wrapped in its own **layout** and gated by its own **route guard**, so the two experiences never bleed into each other by accident.

---

## Features

- 🛍️ **Shop** (`/`) — hero, category slider, search, category filters, best sellers and flash-sale sections; the static demo catalog merged with real seller listings from the database
- 🛒 **Cart & checkout** (`/cart`) — server-side cart per account; checkout re-prices every item from the live product and creates a real order
- 🔑 **Real authentication** via Supabase Auth — signup (with strong-password policy and generator), login, logout, and an emailed forgot/reset-password flow
- 🏪 **Become a seller** (`/sell`) — one form upgrades a shopper account (or creates a new one) into a seller account
- 📦 **Seller dashboard** (`/dashboard/*`) — overview stats, My Products (create/edit/delete with photo uploads to Supabase Storage), Orders (advance Processing → Shipped → Delivered), Advertise (campaigns stored per seller in the browser), Settings (store details and logo)
- 💬 **Real-time messaging** (`/messages`) — buyer ↔ seller chat with live delivery over Supabase Realtime and an unread indicator in the navbar
- 👤 **Profile** (`/profile`) — personal details and order history
- 🔐 **Server-side authorization** — every data request goes through the Express API, which verifies the Supabase token and enforces seller/owner rules
- 🚧 **Route guards** — dashboard requires a seller account; profile/messages require sign-in; login/signup redirect away once signed in
- 🧩 **Reusable form components** (`Input`, `TextArea`, `Button`) with inline validation errors
- 📱 **Fully responsive**, brand-driven design (navy, blue and orange from the BestMart logo), real photography, branded favicon

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| UI Library | [React 19](https://react.dev/) | Component-based UI |
| Build Tool | [Vite 8](https://vitejs.dev/) | Dev server + production bundling |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) (via `@tailwindcss/vite`) | Utility-first styling, brand colors defined as CSS theme tokens |
| Routing | [React Router v7](https://reactrouter.com/) | Client-side routing, nested layouts, route guards |
| State | React Context API | `AuthContext` (session + profile), `CartContext` (cart), `ProductsContext` (catalog) |
| API | [Express 5](https://expressjs.com/) | `server/` — auth middleware, validation, all data reads/writes; runs as a Vercel serverless function |
| Backend services | [Supabase](https://supabase.com/) | Postgres database, Auth (passwords, JWTs, email), Storage (product photos/logos), Realtime (chat) |
| Uploads | [multer](https://github.com/expressjs/multer) | In-memory multipart parsing for image uploads |
| Icons | [react-icons](https://react-icons.github.io/react-icons/) (`Hi`, `Hi2`, `Fa` icon sets) | Navigation, footer, and form iconography |
| HTTP Client | `fetch` (wrapped in `src/lib/apiClient.js`) | Adds the Supabase access token to every API call |
| Language | JavaScript (JSX) | No TypeScript in this iteration |

No CSS-in-JS, no component libraries (e.g. MUI, Chakra) — every visual element is composed from Tailwind utility classes and custom components.

---

## Project Structure

```
bestmart/
├── api/
│   ├── index.js                  # Vercel serverless entry — hands every /api/* request to Express
│   └── health.js                 # Zero-dependency diagnostic endpoint (/api/health)
├── server/
│   ├── app.js                    # Express app: middleware, route mounting, error handling
│   ├── dev.js                    # Local-only: runs app.js as a normal Node server on :3001
│   ├── lib/
│   │   ├── supabaseAdmin.js      # Service-role Supabase client (server only!)
│   │   ├── catalog.js            # Authoritative product lookup (DB + demo catalog) for prices/sellers
│   │   ├── imageUpload.js        # Shared image-upload middleware (type/size checks, Storage upload)
│   │   └── asyncHandler.js
│   ├── middleware/auth.js        # authenticate / loadProfile / requireSeller
│   └── routes/                   # profile, products, cart, checkout, orders, seller, conversations
├── supabase/migrations/          # SQL to run in the Supabase SQL editor, in order (001 → 007)
├── public/                       # Favicons
├── src/
│   ├── assets/                   # Logo variants, About photo, one photo per category
│   ├── components/               # Navbar, Footer, Sidebar, ProductCard, ui/ (Button, Input, TextArea)
│   ├── context/                  # AuthContext, CartContext, ProductsContext
│   ├── data/                     # Demo catalog + categories (also used by the server), category images
│   ├── hooks/                    # useUnreadMessages, useLocalStorageList
│   ├── layouts/                  # UnauthWrapper (navbar + footer), AuthWrapper (sidebar)
│   ├── lib/                      # supabaseClient (Auth + Realtime only), apiClient (calls /api)
│   ├── pages/                    # Shop, Cart, Login, Signup, SellerSignup, Forgot/ResetPassword,
│   │   │                         # Profile, Messages, About, Contact, HelpCenter, NotFound
│   │   └── dashboard/            # Dashboard, Products, Advertise, Orders, Settings
│   ├── routes/                   # routesConfig, AppRoutes, ProtectedRoute, AccountRoute, GuestRoute
│   └── utils/                    # passwordPolicy, productImages, orderLineItems, money
├── vercel.json                   # SPA + /api rewrites
├── vite.config.js                # Proxies /api to the local Express server in dev
└── .env.example                  # Required environment variables
```

---

## Pages

### `/` — Shop (home)
Hero, category slider, search, category filters, best sellers and a flash-sale section. Products are the static demo catalog (`src/data/products.js`, ids 1–12) merged with real seller listings from the database (ids from 1000). Each card shows photos, seller, price in ₵ and buttons to add to cart or message the seller.

### `/cart` — Cart
The signed-in user's server-side cart: quantity input, remove, running total, and **Checkout**, which creates a real order (no payment integration yet).

### `/login`, `/signup`, `/sell`
Supabase Auth sign-in and sign-up. `/sell` creates a seller account, or upgrades the signed-in shopper's account by adding a shop name. If the Supabase project requires email confirmation, the signup details are kept in the account's metadata and the profile is created on first login.

### `/forgot-password` → `/reset-password`
Supabase emails a reset link; opening it signs the user in with a short-lived recovery session, and `/reset-password` lets them choose a new password. Expired or used links show an explicit "invalid or expired" state.

### `/profile` and `/messages` (signed in)
Profile shows personal details and order history. Messages is a real-time chat between buyers and sellers, opened from a product's "Message seller" button.

### `/about` — About
A dark hero banner, a real photo paired with the company story, and key stats (Happy Customers, Products Listed, Trusted Sellers, Cities Served).

### `/contact` — Contact
A dark hero banner, a Ghana business-details sidebar (Accra address, `+233` phone, email), and a validated contact form.

### `/dashboard` and `/dashboard/*` — Seller Dashboard (protected)
Only reachable by signed-in sellers. `/dashboard` shows stat tiles (Products Listed, Active Ads, Orders, Revenue). `/dashboard/products` manages the seller's own listings with photo uploads, `/orders` lists orders containing their products and advances their status, `/advertise` manages ad campaigns (stored in the browser for now), and `/settings` edits store details and the logo.

### `*` — Not Found
Any unmatched URL renders a simple 404 page with a link back home.

---

## Layouts ("Wrapper" components)

Two components exist purely to wrap shared UI around whichever page is currently active — the pattern requested for this build:

### `layouts/UnauthWrapper.jsx`
Renders `Navbar` + `<Outlet />` + `Footer`. Every non-dashboard route (`/`, `/cart`, `/about`, `/contact`, `/login`, `/signup`, `/profile`, `/messages`, …) is nested under this layout in `AppRoutes.jsx`, so they all get the same navbar and footer without importing them individually.

### `layouts/AuthWrapper.jsx`
Renders `Sidebar` + `<Outlet />`. Every dashboard route is nested under this layout instead, giving the authenticated area a completely different shell (no public navbar/footer) with zero duplicated markup.

`<Outlet />` is React Router's placeholder — it's where the matched child route's page component actually renders inside the wrapper.

---

## Authentication & Protected Routes

Authentication is **Supabase Auth**: it hashes passwords, issues JWT access tokens and sends confirmation/reset emails. `src/context/AuthContext.jsx` wraps it:

- `registerAccount()`, `authenticate()`, `logout()`, `updateUser()`
- `user` — the profile from `GET /api/profile` (name, `isSeller`, store details); `isAuthenticated` and `loading` for the guards
- A Supabase auth listener restores the session on page load and keeps tabs in sync (logging out in one tab logs out the others)

**Authorization lives on the server.** The browser sends its access token as `Authorization: Bearer …`; `server/middleware/auth.js` verifies it with Supabase and sets `req.userId`, and `requireSeller` / ownership checks guard seller-only actions. The browser's public anon key is only used for Auth and for receiving Realtime events about its own conversations — after migration `007`, it can't write to any table directly.

Three route components apply the conditions in the UI:

- **`ProtectedRoute`** — dashboard routes. Signed out → `/login`; signed in but not a seller → `/sell`.
- **`AccountRoute`** — `/profile`, `/messages`. Signed out → `/login`.
- **`GuestRoute`** — `/login`, `/signup`, `/forgot-password`. Signed in → back to where they came from (or `/`).

---

## Routing

Routing is handled by **React Router v7**, initialized in `main.jsx` with `<BrowserRouter>`. Unlike a typical flat route list, everything is driven by one data file and one small component that maps over it:

**`routes/routesConfig.js`** — the only file you touch to add a page:

```js
export const publicRoutes = [
  { path: '/', element: Shop },
  { path: '/cart', element: Cart },
  { path: '/about', element: About },
  { path: '/contact', element: Contact },
  { path: '/sell', element: SellerSignup },
  { path: '/reset-password', element: ResetPassword },
  // ...
]

export const guestRoutes = [   // signed-out only
  { path: '/login', element: Login },
  { path: '/signup', element: Signup },
  { path: '/forgot-password', element: ForgotPassword },
]

export const accountRoutes = [ // signed in, any role
  { path: '/profile', element: Profile },
  { path: '/messages', element: Messages },
]

export const privateRoutes = [ // signed-in sellers
  { path: '/dashboard', element: Dashboard },
  { path: '/dashboard/products', element: Products },
  // ...
]
```

Every page except the Shop is loaded on demand with `React.lazy`, and `AppRoutes` wraps the routes in `<Suspense>`, so the first page load only downloads what the shop needs.

**`routes/AppRoutes.jsx`** — turns those arrays into real routes with `.map()`, applying the right layout + guard to each group:

```jsx
<Routes>
  <Route element={<UnauthWrapper />}>
    {publicRoutes.map(({ path, element: Element }) => (
      <Route key={path} path={path} element={<Element />} />
    ))}
    <Route element={<GuestRoute />}>
      {guestRoutes.map(({ path, element: Element }) => (
        <Route key={path} path={path} element={<Element />} />
      ))}
    </Route>
  </Route>

  <Route element={<ProtectedRoute />}>
    <Route element={<AuthWrapper />}>
      {privateRoutes.map(({ path, element: Element }) => (
        <Route key={path} path={path} element={<Element />} />
      ))}
    </Route>
  </Route>

  <Route path="*" element={<NotFound />} />
</Routes>
```

`App.jsx` renders `<AuthProvider><CartProvider><AppRoutes /></CartProvider></AuthProvider>` — routing, auth, and cart state are all wired together at the very top of the tree.

---

## Cart & Shop

`CartContext` and `ProductsContext` load their data from the API and expose actions (`addToCart`, `updateQty`, `removeFromCart`, `checkout`; `addProduct`, `updateProduct`, `deleteProduct`) through `useCart()` / `useProducts()`, so the product cards, navbar badge and cart page stay in sync.

Prices are never trusted from the browser: adding to the cart sends only a product id, and the server builds the line from the real product (`server/lib/catalog.js`). Checkout re-prices every line from the live product again, attributes each item to its real seller, and removes items that are no longer for sale.

---

## Shared Components

### `Navbar.jsx`
Sticky, translucent public top bar. Desktop links (Shop, Contact, Help Center) via `NavLink` for active-state styling, a search box, a cart icon with a live badge, a messages icon with an unread dot, and auth-aware actions (Login/Signup vs. Profile/Dashboard). Includes a mobile hamburger menu.

### `Footer.jsx`
Four-column responsive layout on a navy background: brand + socials, quick links, customer service links, and Ghana contact details.

### `Sidebar.jsx`
Dashboard-only side navigation (desktop rail + mobile slide-out drawer): links to every `/dashboard/*` page, the logged-in user's name/email, and a logout button that calls `logout()` and returns to the homepage.

### `ProductCard.jsx`
One product tile on the Shop page — category photo, name, seller, price, and an Add-to-cart button wired to `CartContext`.

### `ui/Input.jsx`, `ui/TextArea.jsx`
Accept `label`, `id`, `error`, and standard input/textarea props; centralize all field styling so every form looks and behaves identically.

### `ui/Button.jsx`
Accepts a `variant` prop (`primary`, `accent`, `outline`, `ghost`) mapped to a Tailwind class set — `accent` (orange) is reserved for the platform's main calls-to-action (Shop Now, Sign Up, Checkout).

---

## Design System

Colors are pulled directly from the BestMart logo and defined once as Tailwind v4 theme tokens in `src/index.css` (`@theme { --color-brand-blue: ...; --color-brand-orange: ...; }`), which automatically generates utilities like `bg-brand-blue` and `text-brand-orange`:

- **Navy** (`brand-navy`) — dark sections: footer, hero banners, sidebar, dashboard promo band
- **Blue** (`brand-blue` / `brand-blue-light` / `brand-blue-dark`) — primary actions, links, active nav states — trust and structure
- **Orange** (`brand-orange` / `brand-orange-light` / `brand-orange-dark`) — the platform's "do this" color: Sign Up, Add to Cart, Checkout, Shop Now
- **Neutral palette:** Tailwind's `gray` scale for text, borders, and backgrounds
- **Cards & surfaces:** `rounded-xl` / `rounded-2xl` with subtle borders and soft shadows
- **Icons:** Heroicons (`react-icons/hi`, `react-icons/hi2`) for UI, Font Awesome (`react-icons/fa`) for social links

---

## Form Handling & Validation

Login, Sign Up, and Contact follow the same pattern, built with plain React state (no external form library):

1. A single `form` state object holds all field values, updated through one shared `handleChange` handler keyed by `e.target.name`.
2. A `validate()` function runs on submit, builds an `errors` object of only the fields that fail, and returns whether the form is valid.
3. On success, Login/Signup call `login()` and navigate into the dashboard; Contact shows a success banner and resets its fields.
4. Each `Input`/`TextArea` receives its corresponding `error` message, which turns the field's border red and displays the message beneath it.

Validation rules currently implemented:
- **Required fields:** name, email, password, message, etc.
- **Email format:** checked with a regular expression (`/^\S+@\S+\.\S+$/`)
- **Password length:** minimum 6 characters (Sign Up)
- **Password match:** confirm password must equal password (Sign Up)

---

## Component Lifecycle: State, Mounting, and Re-renders

Three ideas that explain almost everything a React component does. In simple terms, with a real example from this codebase for each.

### 1. How a component changes state — and how

A component's state lives in a `useState` call. You never change the variable directly — you call the setter function React gave you, React schedules a re-render, and the component's *next* render uses the new value.

Example — the wishlist heart on `ProductCard.jsx`:

```jsx
const [wishlisted, setWishlisted] = useState(false)

<button onClick={() => setWishlisted((prev) => !prev)}>
  {wishlisted ? <HiHeart /> : <HiOutlineHeart />}
</button>
```

Clicking the button doesn't repaint the icon directly — it calls `setWishlisted`, which tells React "this component's state changed." React then re-runs `ProductCard`'s function body with the new `wishlisted` value, and the icon it returns this time reflects it.

### 2. Mounting and unmounting (showing and going away)

A component **mounts** the first time React renders it into the page, and **unmounts** when React removes it — almost always because a condition that was true just became false. Nothing is hidden with CSS here; the element is actually created and destroyed.

Example — the mobile menu in `Navbar.jsx`:

```jsx
{open && (
  <div className="lg:hidden border-t border-gray-200 bg-white px-4 pb-4">
    {/* mobile links */}
  </div>
)}
```

When `open` is `false`, that `<div>` doesn't exist in the DOM at all — React never mounted it. Tapping the hamburger icon sets `open` to `true`, and React mounts the menu for the first time. Tapping again sets it back to `false`, and React unmounts it — any state that lived *inside* it would be lost, because the component instance itself is gone, not just visually hidden.

### 3. What triggers a re-render

Three things make a component re-run its function body and produce new output:

1. **Its own state changes** — any `setX()` call.
2. **Its props change** — the parent passed it something different this time.
3. **A Context value it reads changes** — every component using that context's hook re-renders together, automatically.

Example of #3 — `AuthContext.jsx` and `Navbar.jsx`:

```jsx
// AuthContext.jsx — after a successful login:
setUser(loggedInUser)

// Navbar.jsx — never calls setUser itself, just reads the context:
const { isAuthenticated } = useAuth()
{isAuthenticated ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Log in</Link>}
```

`Navbar` doesn't know or care *when* `AuthContext` changes — it just reads `isAuthenticated` via `useAuth()`. The instant `AuthContext` calls its own `setUser`, **every** component subscribed to that context — `Navbar`, `Sidebar`, `ProductCard`, the route guards — re-renders on its own, without anyone passing props down by hand. That's the actual payoff of using Context here instead of prop-drilling: one state change, many components update themselves.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 22 (the version Vercel uses, set in `package.json` `engines`; Vite 8 needs at least 20.19)
- A [Supabase](https://supabase.com/) project

### 1. Install

```bash
git clone <repository-url>
cd bestmart
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in the values from **Supabase → Project Settings → API**:

| Variable | Used by | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser | Public anon key |
| `SUPABASE_URL` | Express API | Same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Express API | **Secret.** Never prefix it with `VITE_` — that would ship it to the browser |

### 3. Set up the database

In the Supabase SQL editor, run every file in `supabase/migrations/` in order (`001` through `007`).

### 4. Run locally

```bash
npm run dev
```

Starts Vite (`http://localhost:5173`) and the Express API (`http://localhost:3001`) together; Vite proxies `/api/*` to the API.

### Deploying to Vercel

1. Import the repository in Vercel (framework preset: Vite).
2. Add all four environment variables above under **Project Settings → Environment Variables**.
3. Deploy. `vercel.json` sends `/api/*` to the Express function in `api/index.js` and everything else to the SPA.
4. Check `https://<your-app>/api/health` — it should return `{"ok":true,"hasSupabaseUrl":true,"hasServiceRoleKey":true}`.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server + Express API together |
| `npm run dev:web` | Vite only |
| `npm run dev:api` | Express API only (reads `.env`) |
| `npm run build` | Production build of the front end into `dist/` |
| `npm run preview` | Serve the production build locally (run `npm run dev:api` too for `/api`) |
| `npm run lint` | ESLint over the whole repo |
| `npm run typecheck` | TypeScript strict-mode check of `server/`, `api/`, `shared/` |
| `npm test` | Vitest unit + integration tests (no network needed) |
| `npm run check` | Lint, type-check, test and build: what CI runs |

## Documentation

| Doc | Contents |
|---|---|
| [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | Architecture, stack decisions, modules |
| [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | `/api/v1` conventions, errors, endpoints |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust boundaries, controls, known gaps |
| [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md) | Env vars, environments, quality checks |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Workflow and coding rules |
| [docs/DEVELOPMENT_CHECKLIST.md](docs/DEVELOPMENT_CHECKLIST.md) | Roadmap status by phase |

---

## Responsive Behavior

Every page is mobile-first and verified at both mobile (~390px) and desktop (1280px) viewport widths:

- The Navbar collapses into a hamburger-triggered mobile menu below the `md` breakpoint; the Sidebar collapses into a slide-out drawer with its own top bar.
- Grids (products, feature cards, category cards, values, stats) collapse from 4/6 columns on desktop down to 2 or 1 column on smaller screens.
- Forms remain centered, single-column, and comfortably padded at all widths.
- The Footer's four columns stack vertically on mobile and lay out side-by-side from `sm:` upward.

---

## Project Decisions & Rationale

- **Why separate `UnauthWrapper`/`AuthWrapper` layouts instead of one shared shell:** the public storefront and the seller dashboard are different products wearing the same brand — a navbar+footer doesn't belong around a dashboard, and a sidebar doesn't belong around a landing page. Splitting the layout in two keeps each one simple instead of branching internally on auth state.
- **Why a `routesConfig.js` data file instead of writing `<Route>` tags by hand in `AppRoutes.jsx`:** adding a page becomes a one-line change in one file, with no risk of forgetting to wrap it in the right layout or guard — the `.map()` in `AppRoutes.jsx` handles that consistently every time.
- **Why an Express API in front of Supabase instead of querying it from the browser:** business rules like "the price comes from the product, not the request" or "only the product's owner can edit it" are easiest to read, test and enforce in one server-side place. The browser keeps using Supabase directly only for Auth and Realtime.
- **Why Context API over a state library (Redux, Zustand):** `AuthContext`, `CartContext` and `ProductsContext` each hold a small, well-scoped slice of state with a handful of actions — Context plus a `useX()` hook covers that cleanly without adding a dependency.
- **Why Tailwind CSS v4 over plain CSS or a component library:** keeps styling co-located with markup and avoids pulling in a heavier UI kit for a project whose goal is to demonstrate hand-built component design.
- **Why plain `useState` for forms instead of a form library:** the forms here are small; the goal was to demonstrate understanding of controlled inputs and manual validation, not library integration.
- **Why navy/blue/orange:** pulled directly from the BestMart logo, so the generated UI matches the actual brand identity rather than an arbitrary palette.
- **Why Ghana, not Nigeria, in the contact details:** the platform's actual market — address, phone format, and currency (₵) were corrected to match.

---

## Known Limitations

- Checkout creates an order but takes no payment.
- Ad campaigns (`/dashboard/advertise`) are stored in the browser's `localStorage` per seller, not in the database, and don't affect the shop yet.
- An order containing items from several sellers has a single status, so any of those sellers can advance it.
- The Contact form validates input but doesn't send anything.
- Category and About-page images are stock photography (Pexels).

---

## Roadmap

- [ ] Payment integration (e.g. Mobile Money) at checkout
- [ ] Store ad campaigns in the database and feature advertised products in the shop
- [ ] Per-seller fulfilment status for multi-seller orders
- [ ] Automated tests (API route tests, React Testing Library, Playwright e2e)
- [ ] Replace stock photography with real product and seller photos

---

## Author

Built by **maryakussah123@gmail.com** as part of the WomenTechsters program.

For a walk-through of the specific React conventions used in this codebase (with the why/how/when behind each one, plus notes on every imported package), see [MyReactSoFar.md](MyReactSoFar.md).
