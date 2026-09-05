"use client";

import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import styles from "./auth-action.module.css";

type ActionKind = "verify" | "reset";
type ActionState = "loading" | "ready" | "invalid" | "submitting" | "success" | "error";

export function AuthActionClient({ kind }: { kind: ActionKind }) {
  const credentialRef = useRef<{ challenge: string; token: string } | null>(null);
  const initializedRef = useRef(false);
  const [state, setState] = useState<ActionState>("loading");
  const [message, setMessage] = useState("Checking this secure link...");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useLayoutEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    const challenge = parameters.get("challenge") || "";
    const token = parameters.get("token") || "";
    parameters.delete("challenge");
    parameters.delete("token");

    if (!isValidChallenge(challenge) || !isValidToken(token)) {
      queueMicrotask(() => {
        setState("invalid");
        setMessage("This link is incomplete or invalid. Request a new link from the CUAC sign-in page.");
      });
      return;
    }

    credentialRef.current = { challenge, token };
    queueMicrotask(() => {
      setState("ready");
      setMessage(kind === "verify"
        ? "Confirm below to verify the email address linked to this CUAC account."
        : "Choose a new password with at least 15 characters.");
    });
  }, [kind]);

  async function submitVerification() {
    const credential = credentialRef.current;
    if (!credential || state === "submitting") return;
    setState("submitting");
    setMessage("Verifying your email...");
    try {
      await postAuthAction(`/api/v1/auth/email-verification/${encodeURIComponent(credential.challenge)}/verify`, {
        verificationToken: credential.token,
      });
      credentialRef.current = null;
      setState("success");
      setMessage("Your email address is verified. You can continue to CUAC.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Email verification could not be completed.");
    }
  }

  async function submitPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credential = credentialRef.current;
    if (!credential || state === "submitting") return;
    if (newPassword.length < 15) {
      setState("error");
      setMessage("Use at least 15 characters for the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setState("error");
      setMessage("The two password entries do not match.");
      return;
    }

    setState("submitting");
    setMessage("Updating your password and revoking existing sessions...");
    try {
      await postAuthAction(`/api/v1/auth/password-reset/${encodeURIComponent(credential.challenge)}/reset`, {
        resetToken: credential.token,
        newPassword,
      });
      credentialRef.current = null;
      setNewPassword("");
      setConfirmPassword("");
      setState("success");
      setMessage("Your password has been updated. Sign in again with the new password.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The password could not be updated.");
    }
  }

  const disabled = state === "loading" || state === "invalid" || state === "submitting" || state === "success";

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a className={styles.brand} href="/home-v3.html" aria-label="CUAC home">
          <span className={styles.mark}>CU</span>
          <span>CUAC</span>
        </a>
        <a className={styles.signInLink} href="/auth.html">Sign in</a>
      </header>

      <main className={styles.main}>
        <section className={styles.actionPanel} aria-labelledby="auth-action-title">
          <p className={styles.eyebrow}>{kind === "verify" ? "Account verification" : "Account recovery"}</p>
          <h1 id="auth-action-title">{kind === "verify" ? "Verify your email" : "Set a new password"}</h1>
          <p className={styles.lead}>This action changes only your CUAC account credentials. It does not grant school or internal roles.</p>

          <div className={styles.status} data-state={state} role="status" aria-live="polite">
            <span className={styles.statusMark} aria-hidden="true" />
            <p>{message}</p>
          </div>

          {kind === "verify" ? (
            <button className={styles.primary} type="button" disabled={disabled} onClick={() => void submitVerification()}>
              {state === "submitting" ? "Verifying..." : "Verify email"}
            </button>
          ) : (
            <form className={styles.form} onSubmit={(event) => void submitPasswordReset(event)}>
              <label>
                <span>New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={15}
                  required
                  disabled={disabled}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <label>
                <span>Confirm new password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={15}
                  required
                  disabled={disabled}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <button className={styles.primary} type="submit" disabled={disabled}>
                {state === "submitting" ? "Updating password..." : "Update password"}
              </button>
            </form>
          )}

          {(state === "success" || state === "invalid") && (
            <a className={styles.secondary} href="/auth.html">Return to sign in</a>
          )}

          <p className={styles.securityNote}>For your security, the link credentials were removed from the address bar and are not stored in this browser.</p>
        </section>
      </main>
    </div>
  );
}

async function postAuthAction(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || "This secure link could not be used.");
  return payload?.data;
}

function isValidChallenge(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
