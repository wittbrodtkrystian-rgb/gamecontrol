import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
import { AuthForm } from "@/components/AuthForm";
export const metadata: Metadata = { title: "Logowanie" };
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <PublicShell><div className="px-4"><AuthForm mode="login" next={(await searchParams).next} /></div></PublicShell>;
}
