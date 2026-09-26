import { createHash } from "node:crypto";
import webpush from "web-push";
import { z } from "zod";
import { withV2Db } from "./runtime-database";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(20).max(300),
    auth: z.string().min(8).max(300),
  }),
});
export type BrowserPushSubscription = z.infer<typeof subscriptionSchema>;

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "";
  return publicKey && privateKey && /^mailto:|^https:/.test(subject)
    ? { publicKey, privateKey, subject }
    : null;
}

function safeEndpoint(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("Endpoint inválido.");
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" ||
    host === "web.push.apple.com" ||
    host.endsWith(".push.apple.com");
  if (!allowed) throw new Error("Serviço de notificações não reconhecido.");
  return url.toString();
}
const digest = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex");

export function savePushSubscription(canonicalUserId: number, input: unknown) {
  const parsed = subscriptionSchema.parse(input);
  const endpoint = safeEndpoint(parsed.endpoint);
  withV2Db((db) =>
    db.transaction(() => {
      db.prepare("DELETE FROM push_subscriptions WHERE endpoint_hash=?").run(
        digest(endpoint),
      );
      const count = (
        db
          .prepare("SELECT count(*) n FROM push_subscriptions WHERE user_id=?")
          .get(canonicalUserId) as { n: number }
      ).n;
      if (count >= 10) throw new Error("Limite de dispositivos atingido.");
      db.prepare(
        "INSERT INTO push_subscriptions(user_id,endpoint_hash,endpoint,p256dh,auth,created_at) VALUES(?,?,?,?,?,?)",
      ).run(
        canonicalUserId,
        digest(endpoint),
        endpoint,
        parsed.keys.p256dh,
        parsed.keys.auth,
        Date.now(),
      );
    })(),
  );
}
export function removePushSubscription(
  canonicalUserId: number,
  endpointInput: unknown,
) {
  const endpoint = safeEndpoint(z.string().url().parse(endpointInput));
  withV2Db((db) =>
    db
      .prepare(
        "DELETE FROM push_subscriptions WHERE user_id=? AND endpoint_hash=?",
      )
      .run(canonicalUserId, digest(endpoint)),
  );
}

export async function sendPushForLegacyUser(
  legacyUserId: number,
  entityType: string,
  entityId: string,
) {
  const config = pushConfiguration();
  if (!config) return;
  const route =
    entityType === "chat_room" && /^\d+$/.test(entityId)
      ? `/chat?room=${entityId}`
      : entityType === "study_group" && /^\d+$/.test(entityId)
        ? `/chat?group=${entityId}`
        : "/today";
  const subscriptions = withV2Db((db) => {
    const row = db
      .prepare(
        "SELECT user_id id FROM legacy_user_links WHERE legacy_user_id=?",
      )
      .get(legacyUserId) as { id: number } | undefined;
    if (!row) return [];
    return db
      .prepare(
        "SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=?",
      )
      .all(row.id) as Array<{
      id: number;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>;
  });
  if (!subscriptions.length) return;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const payload = JSON.stringify({
    title: "OpenStudyHub",
    body: "Você tem uma nova notificação.",
    url: route,
  });
  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 3600 },
        );
        withV2Db((db) =>
          db
            .prepare(
              "UPDATE push_subscriptions SET last_success_at=? WHERE id=?",
            )
            .run(Date.now(), subscription.id),
        );
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410)
          withV2Db((db) =>
            db
              .prepare("DELETE FROM push_subscriptions WHERE id=?")
              .run(subscription.id),
          );
      }
    }),
  );
}
