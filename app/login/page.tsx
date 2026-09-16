"use client";
import { useState } from "react";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="login-card">
        <div className="wordmark">
          PARTIU <strong>MARAGOGI</strong>
          <small>INTELLIGENCE</small>
        </div>
        <h1>Bem-vindo de volta.</h1>
        <p>Acesse a inteligência do seu conteúdo.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(f)),
              });
              const d = await r.json();
              if (!r.ok) throw Error(d.error);
              location.href = "/";
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            E-mail
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Entrando…" : "Entrar na plataforma →"}
          </button>
        </form>
        <small>Acesso restrito à administração.</small>
      </div>
    </main>
  );
}
