import { useState } from "react";
import { FiCreditCard, FiShoppingCart } from "react-icons/fi";
import { initSDK } from "../../services/identity/client";
import Status from "../../components/ui/Status";
import { IDENTITY_ENDPOINT, IDENTITY_API_KEY } from "../../services/identity/config";

const nexid = initSDK({ endpoint: IDENTITY_ENDPOINT, apiKey: IDENTITY_API_KEY });

export default function Checkout() {
  const [amount, setAmount] = useState("199.90");
  const [resp, setResp] = useState<{ s: "allow" | "review" | "deny"; sc: number; id: string } | null>(null);

  async function onPay() {
    const r = await nexid.verify({ context: "checkout" });
    setResp({ s: r.status as any, sc: Math.round(r.score), id: r.requestId });
  }

  return (
    <main className="min-h-dvh grid place-items-center bg-[var(--bg)]">
      <div className="w-full max-w-md p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 grid place-items-center rounded-xl bg-[var(--primary)]/20 text-[var(--primary)]">
            <FiShoppingCart className="text-xl" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">Checkout</h1>
            <p className="text-xs text-white/60">Confirme o pagamento</p>
          </div>
        </div>

        <label className="block text-sm mb-1 text-white/80">Valor</label>
        <input
          className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/50 px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition mb-4"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button
          onClick={onPay}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-600)] active:scale-[.99] px-4 py-3 font-medium transition"
        >
          <FiCreditCard />
          Pagar
        </button>

        {resp && <Status value={resp.s} score={resp.sc} id={resp.id} />}
        <div className="mt-6 h-1 rounded-full bg-gradient-to-r from-[var(--muted)] via-[var(--paper)] to-[var(--primary-600)]/70" />
      </div>
    </main>
  );
}
