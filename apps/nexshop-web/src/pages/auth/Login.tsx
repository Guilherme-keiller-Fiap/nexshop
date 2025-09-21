import { useState } from "react";
import { FiMail, FiLogIn, FiShield } from "react-icons/fi";
import { initSDK } from "../../services/identity/client";
import { sha256Hex } from "../../lib/hash";

const nexid = initSDK({ endpoint: "http://localhost:3000/identity/verify" });

export default function Login() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin() {
    setMsg("verificando identidade…");
    const emailHash = email ? await sha256Hex(email) : undefined;
    const r = await nexid.verify({ context: "login", emailHash });
    setMsg(`${r.status.toUpperCase()} • score ${Math.round(r.score)} • ${r.requestId}`);
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--bg)]">
      <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 grid place-items-center rounded-xl bg-[var(--primary)]/20 text-[var(--primary)]">
            <FiShield className="text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">NexShop</h1>
            <p className="text-xs text-white/60">Faça login para continuar</p>
          </div>
        </div>
        <label className="block text-sm mb-1 text-white/80">Email</label>
        <div className="relative mb-4">
          <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/50 pl-10 pr-4 py-3 outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <button
          onClick={onLogin}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-600)] active:scale-[.99] px-4 py-3 font-medium transition"
        >
          <FiLogIn />
          Entrar
        </button>
        {msg && <p className="mt-4 text-sm text-white/70">{msg}</p>}
        <div className="mt-6 h-1 rounded-full bg-gradient-to-r from-[var(--muted)] via-[var(--paper)] to-[var(--primary-600)]/70" />
      </div>
    </main>
  );
}
