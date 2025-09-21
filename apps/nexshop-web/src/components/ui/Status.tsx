type Props = { value: "allow" | "review" | "deny"; score: number; id: string };
export default function Status({ value, score, id }: Props) {
    const map = {
        allow: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        review: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        deny: "bg-rose-500/20 text-rose-300 border-rose-500/30"
    } as const;
    return (
        <div className={`mt-4 rounded-xl border px-3 py-2 text-sm ${map[value]}`}>
        <div className="font-semibold uppercase">{value} • score {score}</div>
        <div className="text-xs opacity-80">{id}</div>
        </div>
    );
}
