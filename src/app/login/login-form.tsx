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

export function LoginForm({
  labels,
  next,
}: {
  labels: LoginLabels;
  next: string | null;
}) {
  const [state, action] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="access-form login-form">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label>
        {labels.login}
        <input
          name="login"
          type="text"
          maxLength={120}
          autoComplete="username"
          spellCheck={false}
          required
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
      {labels.sharedComputer ? <small>{labels.sharedComputer}</small> : null}
    </form>
  );
}
