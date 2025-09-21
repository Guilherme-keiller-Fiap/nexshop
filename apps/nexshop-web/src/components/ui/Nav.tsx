import { Link, useLocation } from "react-router-dom";

export default function Nav() {
    const { pathname } = useLocation();
    const base = "px-4 py-2 rounded-full";
    const active = "bg-[var(--primary)] text-white";
    const idle = "bg-white/10 text-white/80 hover:bg-white/20";
return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 flex gap-2 backdrop-blur bg-white/5 border border-white/10 rounded-full p-1">
        <Link to="/login" className={`${base} ${pathname === "/login" ? active : idle}`}>Login</Link>
        <Link to="/checkout" className={`${base} ${pathname === "/checkout" ? active : idle}`}>Checkout</Link>
    </nav>
);
}
