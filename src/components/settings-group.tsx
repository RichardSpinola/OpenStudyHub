import type { ReactNode } from "react";
export function SettingsGroup({
  title,
  description,
  children,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`settings-group ${className}`}>
      <header className="settings-group-heading">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="settings-group-body">{children}</div>
    </section>
  );
}
export function SettingsRow({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="settings-preference-row">
      <span className="settings-row-copy">
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <span className="settings-row-control">{children}</span>
    </label>
  );
}
