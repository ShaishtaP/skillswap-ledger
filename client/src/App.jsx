import { Navigate, Route, Routes, useLocation } from 'react-router';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Admin from './pages/Admin.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import Browse from './pages/Browse.jsx';
import Dashboard from './pages/Dashboard.jsx';
import History from './pages/History.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import OfferDetail from './pages/OfferDetail.jsx';
import Profile from './pages/Profile.jsx';
import Signup from './pages/Signup.jsx';
import Teach from './pages/Teach.jsx';
import Wallet from './pages/Wallet.jsx';

// Pages that need a logged-in user. Visitors are sent to the login page and
// brought back afterwards.
function RequireAuth({ children, admin = false }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Browse />} />
        <Route path="offers/:id" element={<OfferDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="teach" element={<RequireAuth><Teach /></RequireAuth>} />
        <Route path="history" element={<RequireAuth><History /></RequireAuth>} />
        <Route path="wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="bookings/:id" element={<RequireAuth><BookingDetail /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
