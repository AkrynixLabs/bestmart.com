import { lazy } from 'react'

// Shop is the landing page, so it ships in the main bundle; every other page
// is loaded on demand (AppRoutes wraps routes in <Suspense>).
import Shop from '../pages/Shop'
const Cart = lazy(() => import('../pages/Cart'))
const About = lazy(() => import('../pages/About'))
const Contact = lazy(() => import('../pages/Contact'))
const HelpCenter = lazy(() => import('../pages/HelpCenter'))
const SellerSignup = lazy(() => import('../pages/SellerSignup'))
const Login = lazy(() => import('../pages/Login'))
const Signup = lazy(() => import('../pages/Signup'))
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'))
const ResetPassword = lazy(() => import('../pages/ResetPassword'))
const Profile = lazy(() => import('../pages/Profile'))
const Messages = lazy(() => import('../pages/Messages'))
const Dashboard = lazy(() => import('../pages/dashboard/Dashboard'))
const Products = lazy(() => import('../pages/dashboard/Products'))
const Advertise = lazy(() => import('../pages/dashboard/Advertise'))
const Orders = lazy(() => import('../pages/dashboard/Orders'))
const Settings = lazy(() => import('../pages/dashboard/Settings'))

/**
 * Every public page lives here. Open to anyone, logged in or not.
 * Add a page? Add one line here — AppRoutes turns this into real
 * <Route> elements with a single .map(), no other file needs to change.
 */
export const publicRoutes = [
  { path: '/', element: Shop },
  { path: '/cart', element: Cart },
  { path: '/about', element: About },
  { path: '/contact', element: Contact },
  { path: '/help-center', element: HelpCenter },
  { path: '/sell', element: SellerSignup },
  // Public, not guest-only: opening the emailed reset link signs the user in
  // with a recovery session, and GuestRoute would then bounce them away
  // before they could choose a new password.
  { path: '/reset-password', element: ResetPassword },
]

/**
 * Guest-only pages: rendered only when NOT logged in. Someone who is
 * already logged in gets redirected away from these (see GuestRoute).
 */
export const guestRoutes = [
  { path: '/login', element: Login },
  { path: '/signup', element: Signup },
  { path: '/forgot-password', element: ForgotPassword },
]

/**
 * Logged-in, any role — unlike privateRoutes below, no isSeller
 * requirement. Rendered on the normal Navbar+Footer chrome, not the
 * dashboard sidebar, and guarded by AccountRoute instead of ProtectedRoute.
 */
export const accountRoutes = [
  { path: '/profile', element: Profile },
  { path: '/messages', element: Messages },
]

/**
 * Everything here requires a logged-in user (seller dashboard area).
 * ProtectedRoute checks auth status before any of these ever render.
 */
export const privateRoutes = [
  { path: '/dashboard', element: Dashboard },
  { path: '/dashboard/products', element: Products },
  { path: '/dashboard/advertise', element: Advertise },
  { path: '/dashboard/orders', element: Orders },
  { path: '/dashboard/settings', element: Settings },
]
