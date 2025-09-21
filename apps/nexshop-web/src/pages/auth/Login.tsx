import { useState } from "react";
import { FiMail, FiLogIn, FiShield } from "react-icons/fi";
import { initSDK } from "../../services/identity/client";
import { sha256Hex } from "../../lib/hash";
import { IDENTITY_ENDPOINT, IDENTITY_API_KEY } from "../../services/identity/config";
import Status from "../../components/ui/Status";

const nexid = initSDK({ endpoint: IDENTITY_ENDPOINT, apiKey: IDENTITY_API_KEY });

function isValidEmail(v: string) {
  const s = v.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<{ s: "allow" | "review" | "deny"; sc: number; id: string } | null>(null);

  function onChangeEmail(v: string) {
    setEmail(v);
    setErr(isValidEmail(v) ? null : "Informe um e-mail válido");
  }

  async function onLogin() {
    if (!isValidEmail(email)) {
      setErr("Informe um e-mail válido");
      return;
    }
    setLoading(true);
    setResp(null);
    try {
      const emailHash = await sha256Hex(email);
      const r = await nexid.verify({ context: "login", emailHash });
      setResp({ s: r.status as any, sc: Math.round(r.score), id: r.requestId });
    } finally {
      setLoading(false);
    }
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
        <div className="relative">
          <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            className={`w-full rounded-xl bg-white/5 border text-white placeholder-white/50 pl-10 pr-4 py-3 outline-none focus:ring-2 transition ${
              err ? "border-rose-500/50 focus:ring-rose-500/60" : "border-white/10 focus:ring-[var(--primary)]"
            }`}
            type="email"
            value={email}
            onChange={(e) => onChangeEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            aria-invalid={!!err}
          />
        </div>
        {err && <p className="mt-2 text-sm text-rose-300">{err}</p>}

        <button
          onClick={onLogin}
          disabled={loading || !!err || !email}
          className={`mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition ${
            loading || !!err || !email
              ? "bg-white/10 text-white/60 cursor-not-allowed"
              : "bg-[var(--primary)] hover:bg-[var(--primary-600)] active:scale-[.99]"
          }`}
        >
          <FiLogIn />
          {loading ? "Verificando..." : "Entrar"}
        </button>

        {resp && <Status value={resp.s} score={resp.sc} id={resp.id} />}
        <div className="mt-6 h-1 rounded-full bg-gradient-to-r from-[var(--muted)] via-[var(--paper)] to-[var(--primary-600)]/70" />
      </div>
    </main>
  );
}
