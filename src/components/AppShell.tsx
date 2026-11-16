import Link from "next/link";
import { Logo, DemoBanner } from "./ui";
import { LogoutButton } from "./Controls";

export function AppShell({ items, user, title, children }: { items: readonly (readonly [string, string])[]; user: { name: string; email: string; role: string }; title: string; children: React.ReactNode }) {
  return (
    <div>
      <DemoBanner />
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-4 md:flex-row">
        <aside className="md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:w-60 md:shrink-0">
          <div className="card flex flex-col gap-4 md:h-full">
            <Logo />
            <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
            <nav className="-mx-1 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
              {items.map(([href, label]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-panel hover:text-white">{label}</Link>)}
            </nav>
            <div className="mt-auto hidden border-t border-line pt-3 text-xs text-slate-400 md:block"><div className="truncate font-medium text-slate-200">{user.name}</div><div className="truncate">{user.email}</div><div className="mt-1 text-neon">{user.role}</div></div>
            <LogoutButton />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-10">{children}</main>
      </div>
    </div>
  );
}
