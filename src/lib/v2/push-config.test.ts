import { it, expect } from "vitest";
import webpush from "web-push";
import { validPushConfiguration } from "./push-config";
it("accepts a matched VAPID key pair and rejects malformed keys or invalid administrator contacts", () => {
  const a = webpush.generateVAPIDKeys(),
    b = webpush.generateVAPIDKeys();
  expect(
    validPushConfiguration({ ...a, subject: "mailto:admin@example.edu" }),
  ).toBe(true);
  expect(
    validPushConfiguration({ ...a, subject: "https://example.edu/contact" }),
  ).toBe(true);
  expect(validPushConfiguration({ ...a, subject: "mailto:" })).toBe(false);
  expect(
    validPushConfiguration({
      ...a,
      privateKey: b.privateKey,
      subject: "mailto:admin@example.edu",
    }),
  ).toBe(false);
  expect(
    validPushConfiguration({
      publicKey: "fake",
      privateKey: "fake",
      subject: "https://example.edu",
    }),
  ).toBe(false);
});
