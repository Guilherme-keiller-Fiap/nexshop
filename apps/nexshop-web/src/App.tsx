import { Routes, Route, Navigate } from "react-router-dom";
import Nav from "./components/ui/Nav";
import Login from "./pages/auth/Login";
import Checkout from "./pages/checkout/Checkout";

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
