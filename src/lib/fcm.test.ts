import { test } from "node:test";
import assert from "node:assert/strict";
import { fcmMessage, fcmServiceAccount } from "./fcm.server";

test("reads the Firebase service account, and ignores anything else", () => {
  const account = fcmServiceAccount(
    JSON.stringify({ type: "service_account", project_id: "innsync", client_email: "a@b.iam", private_key: "k" }),
  );
  assert.deepEqual(account, { project_id: "innsync", client_email: "a@b.iam", private_key: "k" });
  assert.equal(fcmServiceAccount(undefined), null);
  assert.equal(fcmServiceAccount("not json"), null);
  assert.equal(fcmServiceAccount(JSON.stringify({ project_id: "x" })), null);
});

test("an Android alert goes to the app's Alerts channel, with the tag that replaces older ones", () => {
  const m = fcmMessage("tok", { title: "Room 5", body: "Done", tag: "room-5" }).message;
  assert.equal(m.token, "tok");
  assert.deepEqual(m.notification, { title: "Room 5", body: "Done" });
  assert.equal(m.android.priority, "high");
  assert.equal(m.android.notification.channel_id, "alerts");
  assert.equal(m.android.notification.tag, "room-5");
  assert.equal(m.data.tag, "room-5");
  const untagged = fcmMessage("tok", { title: "T", body: "B" }).message;
  assert.equal("tag" in untagged.data, false);
});
