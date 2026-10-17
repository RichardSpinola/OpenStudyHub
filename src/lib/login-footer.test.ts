import { afterEach, beforeEach, expect, it } from "vitest";
import { createDatabase, type DatabaseConnection } from "@/lib/db/client";
import {
  defaultLoginFooter,
  getLoginFooter,
  saveLoginFooter,
} from "./login-footer";
import { saveSearchSameTab, searchUsesSameTab } from "./search-preferences";
let db: DatabaseConnection;
beforeEach(() => {
  db = createDatabase(":memory:");
  db.sqlite.exec(
    "CREATE TABLE app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL)",
  );
});
afterEach(() => db.close());
it("keeps an independent-project footer by default and persists disabling and contact links", () => {
  expect(getLoginFooter(db)).toEqual(defaultLoginFooter);
  const value = {
    enabled: false,
    text: "",
    links: [{ label: "Contato", url: "mailto:contato@example.org" }],
  };
  saveLoginFooter(value, db);
  expect(getLoginFooter(db)).toEqual(value);
});
it("rejects script links, credentials, incomplete links and excessive content without overwriting valid settings", () => {
  saveLoginFooter(defaultLoginFooter, db);
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@example.org",
    "http://example.org",
    "",
  ]) {
    expect(() =>
      saveLoginFooter(
        { ...defaultLoginFooter, links: [{ label: "Link", url }] },
        db,
      ),
    ).toThrow();
  }
  expect(() =>
    saveLoginFooter({ ...defaultLoginFooter, text: "x".repeat(601) }, db),
  ).toThrow();
  expect(getLoginFooter(db)).toEqual(defaultLoginFooter);
});
it("uses safe defaults when stored configuration is malformed", () => {
  db.sqlite
    .prepare("INSERT INTO app_settings VALUES('login.footer','invalid',0)")
    .run();
  expect(getLoginFooter(db)).toEqual(defaultLoginFooter);
});
it("defaults search to the same tab and keeps each user's preference separate", () => {
  expect(searchUsesSameTab(1, db)).toBe(true);
  saveSearchSameTab(1, false, db);
  expect(searchUsesSameTab(1, db)).toBe(false);
  expect(searchUsesSameTab(2, db)).toBe(true);
  saveSearchSameTab(1, true, db);
  expect(searchUsesSameTab(1, db)).toBe(true);
});
