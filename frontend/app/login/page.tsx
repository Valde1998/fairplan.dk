"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/PageLayout";
import { login, errorMessage } from "@/lib/api";
import { saveLogin } from "@/lib/browserSession";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const session = await login(String(form.get("email")), String(form.get("password")));
      saveLogin(session.token);
      router.replace(session.user.is_admin ? "/perioder" : "/personale");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="login">
      <Logo />
      <h1>Log ind</h1>
      <form onSubmit={submit}>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Adgangskode
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={saving}>Log ind</button>
      </form>
    </main>
  );
}
