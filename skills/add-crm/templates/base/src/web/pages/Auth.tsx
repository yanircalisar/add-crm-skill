import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { ErrorAlert } from "../Icon";

function AuthCard({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <div className="crm-auth">
      <div className="crm-auth__inner">
        <div className="crm-logo crm-logo_large slds-m-bottom_large" aria-hidden="true" />
        <form className="slds-card slds-p-around_large" onSubmit={onSubmit}>
          <h1 className="slds-text-heading_medium slds-m-bottom_medium">{title}</h1>
          {children}
        </form>
      </div>
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="slds-form-element slds-m-bottom_medium">
      <label className="slds-form-element__label" htmlFor={props.id}>{label}</label>
      <div className="slds-form-element__control">
        <input className="slds-input" {...props} />
      </div>
    </div>
  );
}

export function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/login", { method: "POST", body: { email, password } });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Log In" onSubmit={submit}>
      {error && <ErrorAlert message={error} />}
      <Input id="email" label="Username" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input id="password" label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="slds-button slds-button_brand slds-button_stretch" disabled={busy}>{busy ? "Logging in…" : "Log In"}</button>
    </AuthCard>
  );
}

export function AcceptInvite({ onDone }: { onDone: () => void }) {
  const token = useLocation().pathname.split("/invite/")[1] ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    setError("");
    try {
      await api("/auth/accept-invite", { method: "POST", body: { token, password } });
      navigate("/", { replace: true });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Set Your Password" onSubmit={submit}>
      {error && <ErrorAlert message={error} />}
      <Input id="new-password" label="New Password (min. 10 characters)" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input id="confirm-password" label="Confirm Password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <button className="slds-button slds-button_brand slds-button_stretch" disabled={busy}>{busy ? "Saving…" : "Save and Log In"}</button>
    </AuthCard>
  );
}
