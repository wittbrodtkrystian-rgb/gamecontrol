import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
import { AuthForm } from "@/components/AuthForm";
export const metadata: Metadata = { title: "Rejestracja" };
export default function Register() { return <PublicShell><div className="px-4"><AuthForm mode="register" /></div></PublicShell>; }
