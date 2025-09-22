import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Login from "./pages/auth/Login";
import Checkout from "./pages/checkout/Checkout";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="fixed top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/5 rounded-full p-1 border border-white/10 shadow">
        <NavLink
          to="/login"
          className={({ isActive }) =>
            [
              "relative px-5 py-2 rounded-full transition font-medium",
              isActive
                ? "bg-[var(--primary)] text-white ring-2 ring-[var(--primary-600)] ring-offset-2 ring-offset-[var(--bg)] shadow"
                : "bg-white/10 text-white/80 hover:text-white"
            ].join(" ")
          }
        >
          Login
        </NavLink>
        <NavLink
          to="/checkout"
          className={({ isActive }) =>
            [
              "relative px-5 py-2 rounded-full transition font-medium",
              isActive
                ? "bg-[var(--primary)] text-white ring-2 ring-[var(--primary-600)] ring-offset-2 ring-offset-[var(--bg)] shadow"
                : "bg-white/10 text-white/80 hover:text-white"
            ].join(" ")
          }
        >
          Checkout
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
