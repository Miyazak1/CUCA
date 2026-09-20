"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import styles from "../auth-action.module.css";

type State = "loading" | "ready" | "invalid" | "submitting" | "success" | "error";
type Credential = { inviteId: string; inviteToken: string };

export function SchoolInviteClient() {
  const credentialRef = useRef<Credential | null>(null);
  const initializedRef = useRef(false);
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("Checking this secure invitation...");
  const [signedIn, setSignedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useLayoutEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const inviteId = parameters.get("invite") || "";
    const inviteToken = parameters.get("token") || "";

    if (!isValidUuid(inviteId) || !isValidToken(inviteToken)) {
      queueMicrotask(() => {
        setState("invalid");
        setMessage("This invitation is incomplete or invalid. Ask your CUAC administrator to send a new invitation.");
      });
      return;
    }

    credentialRef.current = { inviteId, inviteToken };
    void detectSession().then((active) => {
      setSignedIn(active);
      setState("ready");
      setMessage(active
        ? "You are signed in. Accepting will explicitly add this school workspace to your existing account."
        : "Create a school staff account for the invited email. This does not create student access.");
    });
  }, []);

  async function submitNewAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credential = credentialRef.current;
    if (!credential || state === "submitting") return;
    if (password.length < 15) {
      setState("error");
      setMessage("Use at least 15 characters for the password.");
      return;
    }
    if (password !== confirmPassword) {
      setState("error");
      setMessage("The two password entries do not match.");
      return;
    }

    setState("submitting");
    setMessage("Creating your school workspace account...");
    try {
      await postInviteAction(credential, "activate", {
        password,
        ...(displayName.trim() ? { displayName } : {}),
      });
      credentialRef.current = null;
      setPassword("");
      setConfirmPassword("");
      setState("success");
      setMessage("School access is activated. Sign in with the invited email, then complete staff security setup.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "School access could not be activated.");
    }
  }

  async function acceptExistingAccount() {
    const credential = credentialRef.current;
    if (!credential || state === "submitting") return;
    setState("submitting");
    setMessage("Adding the school workspace to your signed-in account...");
    try {
      await postInviteAction(credential, "accept", {});
      credentialRef.current = null;
      setState("success");
      setMessage("School access was added to your account. Sign in again and choose the school workspace.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The invitation could not be accepted.");
    }
  }

  const disabled = state === "loading" || state === "invalid" || state === "submitting" || state === "success";

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/home-v3.html" aria-label="CUAC home"><span className={styles.mark}>CU</span><span>CUAC</span></a>
        <a className={styles.signInLink} href="/auth.html?role=school">Sign in</a>
      </header>
      <main className={styles.main}>
        <section className={styles.actionPanel} aria-labelledby="school-invite-title">
          <p className={styles.eyebrow}>School staff invitation</p>
          <h1 id="school-invite-title">Activate school access</h1>
          <p className={styles.lead}>Access is limited to the school and role named in this one-time invitation.</p>
          <div className={styles.status} data-state={state} role="status" aria-live="polite">
            <span className={styles.statusMark} aria-hidden="true" /><p>{message}</p>
          </div>

          {signedIn ? (
            <button className={styles.primary} type="button" disabled={disabled} onClick={() => void acceptExistingAccount()}>
              {state === "submitting" ? "Accepting invitation..." : "Accept with this account"}
            </button>
          ) : state !== "success" && state !== "invalid" ? (
            <form className={styles.form} onSubmit={(event) => void submitNewAccount(event)}>
              <label><span>Your name (optional)</span><input autoComplete="name" maxLength={120} disabled={disabled} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
              <label><span>Create password</span><input type="password" autoComplete="new-password" minLength={15} required disabled={disabled} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label><span>Confirm password</span><input type="password" autoComplete="new-password" minLength={15} required disabled={disabled} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              <button className={styles.primary} type="submit" disabled={disabled}>{state === "submitting" ? "Activating..." : "Activate school account"}</button>
            </form>
          ) : null}

          {!signedIn && state !== "success" && (
            <p className={styles.securityNote}>Already have a CUAC account for the invited email? Sign in first, then open the invitation link again to explicitly add the school workspace.</p>
          )}
          {(state === "success" || state === "invalid") && <a className={styles.secondary} href="/auth.html?role=school">Return to sign in</a>}
          <p className={styles.securityNote}>Invitation credentials are removed from the address bar and are never stored in this browser.</p>
        </section>
      </main>
    </div>
  );
}

async function detectSession() {
  try {
    const response = await fetch("/api/v1/me", { credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return false;
    const payload = await response.json().catch(() => null);
    return Boolean(payload?.data?.actorUserId && payload.data.activeRole !== "guest");
  } catch {
    return false;
  }
}

async function postInviteAction(credential: Credential, action: "activate" | "accept", fields: { password?: string; displayName?: string }) {
  const response = await fetch(`/api/v1/auth/school-invites/${encodeURIComponent(credential.inviteId)}/${action}`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ inviteToken: credential.inviteToken, ...fields }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "This secure invitation could not be used.");
  return payload?.data;
}

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
