"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { loginAction, type LoginActionState } from "@/app/login/actions";

const initialState: LoginActionState = { status: "idle" };

type LoginLabels = {
  login: string;
  password: string;
  loginAction: string;
  invalidCredentials: string;
  sharedComputer: string;
};

function LoginSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "..." : label}
    </button>
  );
}

export function LoginForm({ labels }: { labels: LoginLabels }) {
  const [state, action] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="access-form login-form">
      <label>
        {labels.login}
        <input
          name="login"
          type="text"
          maxLength={120}
          autoComplete="username"
          spellCheck={false}
          required
          autoFocus
        />
      </label>
      <label>
        {labels.password}
        <input
          name="password"
          type="password"
          maxLength={128}
          autoComplete="current-password"
          required
        />
      </label>
      {state.status === "invalid" ? (
        <p className="form-error" role="alert">
          {labels.invalidCredentials}
        </p>
      ) : null}
      <LoginSubmit label={labels.loginAction} />
      <small>{labels.sharedComputer}</small>
    </form>
  );
}
