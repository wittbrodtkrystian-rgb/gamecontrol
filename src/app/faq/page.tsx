import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
export const metadata: Metadata = { title: "FAQ" };
const faq = [
  ["Jak szybko dostanę serwer?", "Po potwierdzeniu płatności system automatycznie tworzy serwer. W trybie DEMO dzieje się to natychmiast, ale serwer jest symulowany."],
  ["Czy mogę zmienić pakiet?", "Tak — skontaktuj się ze wsparciem. Automatyczna zmiana pakietu pojawi się w kolejnych etapach."],
  ["Jak działają płatności?", "Docelowo przez Stripe, z abonamentem miesięcznym. Obecnie dostępny jest wyłącznie tryb demonstracyjny bez pobierania pieniędzy."],
  ["Co z moimi danymi?", "Dane kont są izolowane, a działania administracyjne są zapisywane w logu audytowym."],
  ["Co się stanie, gdy abonament wygaśnie?", "Wyślemy powiadomienie przed końcem okresu, a po wygaśnięciu serwer zostanie zawieszony do czasu przedłużenia."],
];
export default function Faq() {
  return <PublicShell><div className="mx-auto max-w-3xl px-4 pt-12"><h1 className="text-3xl font-bold">Najczęstsze pytania</h1>
    <div className="mt-6 space-y-3">{faq.map(([q, a]) => <details key={q} className="card group"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-3 text-sm text-slate-400">{a}</p></details>)}</div></div></PublicShell>;
}
