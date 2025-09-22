import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Nav from "./components/ui/Nav";
import Login from "./pages/auth/Login";
import Checkout from "./pages/checkout/Checkout";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0b1020] text-white">
        <Nav />
        <main className="max-w-3xl mx-auto p-4">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
