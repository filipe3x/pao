import { useEffect, useRef, useState } from "react";
import { adminUnlock } from "../lib/api";
import { setAdminToken, useStore } from "../lib/store";

export function AdminLockButton() {
  const adminToken = useStore((s) => s.adminToken);
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!pass) return;
    setBusy(true);
    setError(null);
    try {
      const token = await adminUnlock(pass);
      setAdminToken(token);
      setPass("");
      setOpen(false);
    } catch {
      setError("Password inválida.");
    } finally {
      setBusy(false);
    }
  };

  const lock = () => {
    setAdminToken(null);
  };

  if (adminToken) {
    return (
      <button className="lock-btn unlocked" onClick={lock} title="Trancar a edição de defaults">
        🔓 admin
      </button>
    );
  }

  return (
    <>
      <button className="lock-btn" onClick={() => setOpen(true)} title="Destrancar a edição de defaults">
        🔒 trancado
      </button>
      {open && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="list-card new-recipe-card" style={{ maxWidth: 420 }}>
            <button className="close" onClick={() => setOpen(false)} aria-label="Fechar">
              ×
            </button>
            <div className="list-head">
              <div className="kicker">Modo admin</div>
              <h2>Destrancar</h2>
              <div className="meta">para editar os defaults globais das receitas</div>
            </div>
            <form onSubmit={submit}>
              <div className="field">
                <label className="f-label">Password</label>
                <input
                  ref={inputRef}
                  className="f-input"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.currentTarget.value)}
                  autoComplete="current-password"
                />
                {error && (
                  <div className="kicker" style={{ marginTop: 8, color: "var(--sienna-deep)" }}>
                    {error}
                  </div>
                )}
              </div>
              <div className="list-actions">
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary" disabled={busy || !pass}>
                  {busy ? "A validar…" : "Destrancar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
