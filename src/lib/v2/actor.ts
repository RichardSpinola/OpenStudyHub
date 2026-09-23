export type Actor =
  { kind: "admin"; id: number } | { kind: "user"; id: number };

export const adminActor = (id: number): Actor => ({ kind: "admin", id });
export const userActor = (id: number): Actor => ({ kind: "user", id });
