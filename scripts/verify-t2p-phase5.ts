#!/usr/bin/env bun
/**
 * verify:t2p-phase5 — THE THREE FAILURE PATHS OF TEXT-TO-POST THAT NOTHING HAD PROVEN YET, AND
 * ALL THREE OF THEM ARE RACES: two people approving at the same instant, the provider delivering
 * the same webhook twice at the same instant, and two publications being recorded at the same
 * instant. Every other Phase-5 scenario is already covered by an existing suite (see the note at
 * the bottom of this header), so this file proves only what those suites cannot.
 *
 * WHY A RACE IS THE INTERESTING CASE. A sequential second approval is easy to refuse — the row is
 * already `approved` when you read it. The question this suite answers is what happens when BOTH
 * callers read the row BEFORE either has written: does one of them win and the other get a
 * sentence, or do two approvals / two drafts / two publication entries get written for one act?
 * Each section drives the real module, then reads the DATABASE for the answer, because a write
 * that returns a refusal and stored something anyway would pass a shape check and fail here.
 *
 * WHAT IS PROVEN
 *   A. THE ENVIRONMENT AND THE MIGRATIONS — every SMS setting is deleted from this process before
 *      anything runs (so no arm of this suite can hand a message to a provider), and the schema
 *      migrates twice, the second time applying nothing.
 *   B. THE FIXTURES — one client workspace with the brand ledger a draft needs, three members
 *      holding DIFFERENT rights (approve / edit / publish), one authorized SMS sender and one
 *      connected account. The rights are asserted, so a refusal below is about the race and not
 *      about a missing permission.
 *   C. SIMULTANEOUS APPROVALS — two approvals of the same pending draft fired at once from two
 *      different people: exactly one is accepted, exactly ONE approval row exists, the item stands
 *      at approval version 1 with the stored digest of its stored bytes, and the loser is told in
 *      words that the item moved (never a silent second approval). Then an approval racing an EDIT
 *      of the same draft: whatever order they land in, the item can never stand `approved` over
 *      bytes that are not the bytes the approval names.
 *   D. DUPLICATE WEBHOOKS AT THE SAME INSTANT — the same provider message delivered three times
 *      simultaneously: all three get the one accepted answer, nothing throws, and the workspace
 *      holds exactly ONE message row, ONE content item and ONE draft. A fourth, sequential delivery
 *      is still a duplicate, and a different provider id from the same sender still drafts its own
 *      item (the guard is per message, not "one per sender for ever").
 *   E. A PUBLICATION RECORDED TWICE AT THE SAME INSTANT — the same failed fact recorded twice
 *      concurrently appends ONE entry; two DIFFERENT facts recorded concurrently append one of them
 *      and refuse the other with "read the item again" rather than losing it silently. The item is
 *      never moved to `published` by a failure, a failed entry carries no address and no moment,
 *      and the entry names the item's real approval version — not one a caller typed.
 *
 * ALREADY COVERED ELSEWHERE, so deliberately NOT re-proven here: tenant isolation and the
 * regulated-workspace rule (verify:t2p-approval J, verify:t2p-export E, verify:t2p-brand E);
 * wrong-number / unverified / opted-out inbound SMS and the sequential duplicate delivery
 * (verify:t2p-sms C, D, F); preview-link and media expiry (verify:t2p-approval H12,
 * verify:t2p-media-library J); the failed-publish status and the failed publication entry
 * (verify:content, verify:publications); timezone day attribution (verify:content L,
 * verify:t2p-approval F3/F5); opt-out handling on the outbound side (verify:t2p-follow-up).
 *
 * WHAT IT NEVER DOES: no network call to a provider (every SMS setting is deleted first and the
 * only sending number is never set), no model call (the deterministic template model is injected),
 * no email, no publish, no charge. It refuses a non-loopback server because it creates and drops a
 * database, and it drops that database in a `finally`.
 *
 * Run it:
 *   VERIFY_DATABASE_ADMIN_URL=postgres://verify_admin:verify_admin@127.0.0.1:5432/postgres \
 *     bun run verify:t2p-phase5
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { closeDatabase, driverKindFor, sql, type DbRow } from "../src/db";
import { runMigrations } from "./migrate";
import { resolveActor } from "../src/server/authz/actor";
import { assertCan } from "../src/server/authz/decide";
import { createBrandKnowledgeEntryAs, saveBrandProfileAs } from "../src/server/authz/brand";
import { generateStudioDraftForScope } from "../src/server/authz/t2p-studio";
import { templateStudioModel } from "../src/server/t2p/studio-model";
import { contentDigest, variantDigest } from "../src/server/content/state";
import {
  APPROVAL_PERMISSION,
  DRAFT_EDIT_PERMISSION,
  approveDraftSubjectForScope,
  editDraftForScope,
  listApprovalQueueForScope,
  submitDraftForApprovalForScope,
  type ActIdentity,
} from "../src/server/authz/t2p-approval";
import { CONTENT_PUBLISH_PERMISSION, recordPublicationForScope } from "../src/server/authz/content";
import { SCHEDULE_TIMEZONE } from "../src/config/t2p-approval";
import { INBOUND_SMS_ACCEPTED_BODY, INBOUND_SMS_API_PATH, SMS_ENV } from "../src/config/t2p-sms";
import { inboundSmsRequestOutcome } from "../src/server/inbound-sms-area";
import { SMS_RECEIVED_EVENT_TYPE } from "../src/server/t2p/sms-webhook";
import type { OrganizationScope } from "../src/server/authz/types";

/* ------------------------------------------------------------------------- harness */
let passed = 0;
let failed = 0;
const failureLines: string[] = [];
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`PASS  ${label}${detail ? `  (${detail})` : ""}`);
    return;
  }
  failed += 1;
  const line = `FAIL  ${label}${detail ? `  — ${detail}` : ""}`;
  failureLines.push(line);
  console.error(line);
}
function section(title: string): void {
  console.log(`\n── ${title}`);
}
function adminUrlFor(): string {
  const explicit = process.env.VERIFY_DATABASE_ADMIN_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!explicit) {
    throw new Error(
      "verify:t2p-phase5 needs a Postgres server to create its scratch database on.\n" +
        "  export VERIFY_DATABASE_ADMIN_URL=postgres://verify_admin:verify_admin@127.0.0.1:5432/postgres",
    );
  }
  const host = new URL(explicit).hostname;
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(
      `verify:t2p-phase5 creates and drops a database, so it refuses a non-loopback server (${host}). ` +
        "Point VERIFY_DATABASE_ADMIN_URL at 127.0.0.1 — never at the live database.",
    );
  }
  return explicit;
}
const masked = (url: string): string => url.replace(/:[^:@/]*@/, ":***@");
const withDatabase = (url: string, name: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
};
async function rows(sqlText: string, params: unknown[] = []): Promise<DbRow[]> {
  return (await sql().query(sqlText, params)) as unknown as DbRow[];
}
async function count(sqlText: string, params: unknown[] = []): Promise<number> {
  const found = await rows(sqlText, params);
  return Number(found[0]?.count ?? 0);
}
const txt = (value: unknown): string => (value === null || value === undefined ? "" : String(value));
const iso = (value: unknown): string =>
  value === null || value === undefined ? "" : new Date(String(value)).toISOString();
const listOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry));
  if (typeof value === "string" && value.trim().startsWith("{")) {
    return value
      .replace(/^\{|\}$/g, "")
      .split(",")
      .filter((entry) => entry !== "");
  }
  return [];
};
/** The sentence a refused act gives, or "ALLOWED". */
function reason(result: { ok: boolean }): string {
  return result.ok ? "ALLOWED" : String((result as { reason?: string }).reason ?? "NO_REASON");
}
/** Run a call and keep a THROW as a value, so a crash is reported as a failed check, not a dead suite. */
async function attempt<T>(run: () => Promise<T>): Promise<{ threw: false; value: T } | { threw: true; error: string }> {
  try {
    return { threw: false, value: await run() };
  } catch (error) {
    return { threw: true, error: (error as Error).message.split("\n")[0]?.slice(0, 240) ?? "threw" };
  }
}

/* ------------------------------------------------------------------------ fixtures */
/** Synthetic throughout. The numbers are the reserved 555-01XX range. */
const ORG_A = "e5000000-0000-4000-8000-00000000000a";
const U_OWNER = "e6000000-0000-4000-8000-000000000001";
const U_MANAGER = "e6000000-0000-4000-8000-000000000002";
const U_MARKETING = "e6000000-0000-4000-8000-000000000003";
const M_OWNER = "e7000000-0000-4000-8000-000000000001";
const M_MANAGER = "e7000000-0000-4000-8000-000000000002";
const M_MARKETING = "e7000000-0000-4000-8000-000000000003";
const FIXTURE_SENDER = "+12105550131";
const FIXTURE_OUR_NUMBER = "+12105550100";
const WEBHOOK_SECRET = `whsec_${randomBytes(24).toString("base64")}`;
const OWNER_IDENTITY = "phase5.owner@example.test";
const MANAGER_IDENTITY = "phase5.manager@example.test";
const MARKETING_IDENTITY = "phase5.marketing@example.test";
const CLEAN_IDEA = "Remind people we are open Saturday mornings and that they can book an oil change";
const NOW_SUBMIT = "2026-10-10T14:00:00.000Z";
const NOW_APPROVE = "2026-10-10T15:00:00.000Z";
const NOW_EDIT = "2026-10-10T15:30:00.000Z";
const PUBLISHED_AT = "2026-10-14T15:00:00.000Z";

const ACTOR_USER_IDS: Record<string, string> = {
  [OWNER_IDENTITY]: U_OWNER,
  [MANAGER_IDENTITY]: U_MANAGER,
  [MARKETING_IDENTITY]: U_MARKETING,
};
function actorIdentity(identity: string, roleKey: string): ActIdentity {
  return {
    source: "in-app",
    identity,
    userId: ACTOR_USER_IDS[identity] ?? null,
    roleKey,
    kind: "client",
    verified: true,
  };
}

async function itemRow(itemId: string): Promise<DbRow | null> {
  const found = await rows(`select * from content_items where id = $1::uuid`, [itemId]);
  return found[0] ?? null;
}
async function approvalRows(itemId: string): Promise<DbRow[]> {
  return rows(
    `select * from content_draft_approvals where content_item_id = $1::uuid order by decided_at asc, id asc`,
    [itemId],
  );
}
async function variantRows(draftId: string): Promise<DbRow[]> {
  return rows(
    `select * from content_item_draft_variants where draft_id = $1::uuid order by sort_order asc, platform asc`,
    [draftId],
  );
}
/** The Facebook variant of a draft, with its stored digest and the digest recomputed from the bytes. */
async function facebookVariant(draftId: string): Promise<{ id: string; digest: string; recomputed: string }> {
  const found = await variantRows(draftId);
  const row = found.find((entry) => txt(entry.platform) === "facebook") ?? found[0];
  if (row === undefined) throw new Error("the fixture draft stored no variant");
  const headline = row.headline === null ? null : String(row.headline);
  const caption = txt(row.caption);
  const cta = row.cta === null ? null : String(row.cta);
  const hashtags = listOf(row.hashtags);
  return {
    id: String(row.id),
    digest: String(row.digest),
    recomputed: variantDigest({ headline, caption, cta, hashtags }),
  };
}
async function draftFor(scope: OrganizationScope, idea: string): Promise<{ itemId: string; draftId: string }> {
  const generated = await generateStudioDraftForScope(scope, {
    idea,
    channels: ["facebook"],
    createdBy: "TEST — seed",
    model: templateStudioModel,
    now: NOW_SUBMIT,
  });
  if (!generated.ok) throw new Error(`the fixture draft could not be generated: ${generated.reason}`);
  const outcome = generated as unknown as { kind: string; stored: { itemId: string; draftId: string } | null };
  if (outcome.stored === null) throw new Error(`the fixture draft was ${outcome.kind} rather than stored`);
  return { itemId: outcome.stored.itemId, draftId: outcome.stored.draftId };
}

/* ------------------------------------------------------------------ the signed delivery */
/**
 * A DELIVERY SIGNED THE WAY THE PROVIDER DOCUMENTS IT: the signature covers
 * `${webhook-id}.${unix-seconds}.${raw payload}`, HMAC-SHA256, base64, with the secret's `whsec_`
 * prefix stripped and the remainder base64-decoded. Built here so section D drives the real
 * verification the endpoint performs rather than a stub.
 */
function signedHeaders(payload: string, id: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${String(timestamp)}.${payload}`).digest("base64");
  return {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
  };
}
function inboundPayload(smsId: string, text: string): string {
  return JSON.stringify({
    type: SMS_RECEIVED_EVENT_TYPE,
    timestamp: new Date().toISOString(),
    data: {
      sms_id: smsId,
      workspace_id: "ws_fixture",
      to: FIXTURE_OUR_NUMBER,
      from: FIXTURE_SENDER,
      text,
      tags: null,
      metadata: null,
      segments: { count: 1, encoding: "GSM-7" },
    },
  });
}
/** One delivery, as its own Request (a body can be read once, so each concurrent arm needs its own). */
function postInbound(payload: string, headers: Record<string, string>): Request {
  return new Request(`https://www.bravdata.io${INBOUND_SMS_API_PATH}`, { method: "POST", headers, body: payload });
}

/* ------------------------------------------------------------------------------ main */
async function main(): Promise<void> {
  /*
   * NO MESSAGE MAY LEAVE THIS MACHINE BECAUSE OF THIS SUITE. The owner's real key is in this
   * deployment's environment; every SMS setting is removed before anything runs and the removal is
   * asserted, so a confirmation on the inbound path can only ever skip.
   */
  for (const setting of Object.values(SMS_ENV)) delete process.env[setting];

  const adminUrl = adminUrlFor();
  const name = `bravdata_t2p_phase5_${Date.now().toString(36)}_${String(process.pid)}`
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase();
  const admin = postgres(adminUrl, { max: 1, prepare: false, onnotice: () => {} });
  console.log(`verify:t2p-phase5 — scratch database ${name} (server ${masked(adminUrl)}, driver ${driverKindFor(adminUrl)})`);
  try {
    await admin.unsafe(`create database ${name}`);
  } catch (error) {
    console.error(
      `\nThe scratch database could not be created on ${masked(adminUrl)}: ${(error as Error).message}\n` +
        "This suite needs a server that allows `create database` (a local Postgres does).",
    );
    process.exit(1);
  }
  process.env.DATABASE_URL = withDatabase(adminUrl, name);

  try {
    /* ------------------------------------------- A. the environment and the migrations */
    section("A. the provider environment this suite runs in, and the schema");
    check(
      "EVERY SMS SETTING IS GONE FROM THIS PROCESS — no arm of this suite can hand a message to a provider",
      Object.values(SMS_ENV).every((setting) => process.env[setting] === undefined),
      `${String(Object.values(SMS_ENV).length)} setting(s) removed`,
    );
    const first = await runMigrations();
    const second = await runMigrations();
    check(
      "the schema migrates twice, the second run applying nothing (every file is idempotent)",
      first.applied.length > 0 && second.applied.length === 0,
      `applied=${String(first.applied.length)} then ${String(second.applied.length)}`,
    );
    check(
      "and the tables the three races write to are among them",
      first.applied.includes("0029_inbound_messages.sql") &&
        first.applied.includes("0030_content_item_drafts.sql") &&
        first.applied.includes("0042_draft_approval_and_schedule.sql"),
      "0029 + 0030 + 0042",
    );

    /* ---------------------------------------------------------------- B. the fixtures */
    section("B. one workspace, three members with different rights, one authorized sender");
    await sql().query(
      `insert into users (id, email, full_name, can_hold_staff_role, status, clerk_user_id) values
       ($1, $4, 'TEST — phase5 owner', false, 'active', null),
       ($2, $5, 'TEST — phase5 manager', false, 'active', null),
       ($3, $6, 'TEST — phase5 marketing', false, 'active', null)`,
      [U_OWNER, U_MANAGER, U_MARKETING, OWNER_IDENTITY, MANAGER_IDENTITY, MARKETING_IDENTITY],
    );
    await sql().query(
      `insert into organizations (id, slug, name, kind, primary_email, is_demo, status)
       values ($1, 'test-verify-t2p-phase5', 'TEST — phase5 org', 'client', 'test-phase5@example.test', true, 'active')`,
      [ORG_A],
    );
    await sql().query(
      `insert into memberships (id, user_id, organization_id, role_key, location_scope, status) values
       ($1, $4, $7, 'client_owner', 'all', 'active'),
       ($2, $5, $7, 'client_manager', 'all', 'active'),
       ($3, $6, $7, 'client_marketing', 'all', 'active')`,
      [M_OWNER, M_MANAGER, M_MARKETING, U_OWNER, U_MANAGER, U_MARKETING, ORG_A],
    );
    const owner = await resolveActor({ userId: U_OWNER, sessionId: null });
    const manager = await resolveActor({ userId: U_MANAGER, sessionId: null });
    const marketing = await resolveActor({ userId: U_MARKETING, sessionId: null });
    const permsOf = (actor: Awaited<ReturnType<typeof resolveActor>>): string[] =>
      (actor.memberships.find((membership) => membership.organizationId === ORG_A)?.permissions ?? []) as string[];

    const profile = await saveBrandProfileAs(owner, {
      organizationId: ORG_A,
      locationId: null,
      name: "TEST — Phase Five Auto Care",
      industry: "auto repair",
      websiteUrl: "https://phase-five-auto.example.test",
      brandColors: [{ hex: "#1a2b3c", role: "primary" }],
      logoFileRef: "ext:tests/phase5-logo.png",
      logoAltText: "TEST — logo of a car above the shop name",
      contact: {
        phone: "210-000-0011",
        city: "San Antonio",
        region: "TX",
        timezone: SCHEDULE_TIMEZONE,
        hours: [{ day: "saturday", opens: "08:00", closes: "12:00" }],
      },
      toneOfVoice: "plain-spoken",
      audience: "TEST — drivers within five miles",
      contentGoals: ["education"],
      disclaimers: ["TEST — prices change without notice"],
      prohibitedClaims: ["TEST — never say cheapest in town"],
    });
    const service = await createBrandKnowledgeEntryAs(owner, {
      organizationId: ORG_A,
      locationId: null,
      statement: "oil change and brake service",
      category: "service",
      evidenceKind: "client-statement",
      sourceUrl: "",
      sourceNote: "",
      approvedBy: "TEST — owner",
    });
    check(
      "the workspace holds the brand ledger a draft needs (a workspace with no brand profile cannot draft, so this is the fixture's floor)",
      profile.ok === true && service.ok === true,
      `profile=${profile.ok ? "stored" : "refused"} service=${service.ok ? "stored" : "refused"}`,
    );

    const approveScope = (
      await assertCan(manager, APPROVAL_PERMISSION, { organizationId: ORG_A, locationId: null }, { surface: "t2p.approval" })
    ).scope;
    const ownerApproveScope = (
      await assertCan(owner, APPROVAL_PERMISSION, { organizationId: ORG_A, locationId: null }, { surface: "t2p.approval" })
    ).scope;
    const editScope = (
      await assertCan(marketing, DRAFT_EDIT_PERMISSION, { organizationId: ORG_A, locationId: null }, { surface: "t2p.approval" })
    ).scope;
    const viewScope = (
      await assertCan(owner, "record.view", { organizationId: ORG_A, locationId: null }, { surface: "t2p.approval" })
    ).scope;
    const createScope = (
      await assertCan(owner, "record.create", { organizationId: ORG_A, locationId: null }, { surface: "studio.draft.generate" })
    ).scope;
    const publishScope = (
      await assertCan(owner, CONTENT_PUBLISH_PERMISSION, { organizationId: ORG_A, locationId: null }, { surface: "content.publish" })
    ).scope;
    check(
      "TWO members can approve, one holds only the editing right, and the owner can publish — so each refusal below is about the race, not a missing key",
      permsOf(manager).includes(APPROVAL_PERMISSION) &&
        permsOf(owner).includes(APPROVAL_PERMISSION) &&
        permsOf(marketing).includes(DRAFT_EDIT_PERMISSION) &&
        !permsOf(marketing).includes(APPROVAL_PERMISSION) &&
        permsOf(owner).includes(CONTENT_PUBLISH_PERMISSION),
      `manager approve=${String(permsOf(manager).includes(APPROVAL_PERMISSION))} marketing approve=${String(
        permsOf(marketing).includes(APPROVAL_PERMISSION),
      )} owner publish=${String(permsOf(owner).includes(CONTENT_PUBLISH_PERMISSION))}`,
    );

    await sql().query(
      `insert into authorized_inbound_identities (
         id, organization_id, location_id, channel, address, display_name, verification_state,
         verification_method, verified_at, verified_by, messaging_opt_out, may_submit_content, created_by)
       values ($1, $2, null, 'sms', $3, 'TEST — Dana', 'verified', 'provider-confirmed', now(), 'TEST — staff', false, true, 'TEST — fixture')`,
      [randomUUID(), ORG_A, FIXTURE_SENDER],
    );
    await sql().query(
      `insert into social_account_connections (
         id, organization_id, location_id, platform, status, external_account_id, token_ref, connected_at, created_by)
       values ($1, $2, null, 'facebook-page', 'connected', 'page_phase5_fixture', 'ext:test-fixture-no-real-token', now(), 'TEST — fixture')`,
      [randomUUID(), ORG_A],
    );
    process.env[SMS_ENV.webhookSecret] = WEBHOOK_SECRET;
    check(
      "one verified sender may submit content, one account is connected, and the webhook secret exists only in this process",
      (await count(`select count(*)::int as count from authorized_inbound_identities where organization_id = $1::uuid and verification_state = 'verified'`, [ORG_A])) === 1 &&
        (await count(`select count(*)::int as count from social_account_connections where organization_id = $1::uuid and status = 'connected'`, [ORG_A])) === 1 &&
        process.env[SMS_ENV.from] === undefined,
      "1 sender · 1 connection · no sending number",
    );

    /* -------------------------------------------------- C. simultaneous approvals */
    section("C. two approvals of one draft, fired at the same instant");
    const draftOne = await draftFor(createScope, CLEAN_IDEA);
    const variantOne = await facebookVariant(draftOne.draftId);
    await submitDraftForApprovalForScope(editScope, { itemId: draftOne.itemId, now: NOW_SUBMIT });
    const beforeRace = await itemRow(draftOne.itemId);
    check(
      "C0 the fixture draft stands pending with one stored variant whose digest recomputes from its own bytes",
      txt(beforeRace?.status) === "pending" && variantOne.digest === variantOne.recomputed,
      `status=${txt(beforeRace?.status)} digest=${variantOne.digest}`,
    );

    const racedApprovals = await Promise.all([
      attempt(() =>
        approveDraftSubjectForScope(approveScope, {
          draftId: draftOne.draftId,
          variantId: variantOne.id,
          confirmedDigest: variantOne.digest,
          actor: actorIdentity(MANAGER_IDENTITY, "client_manager"),
          now: NOW_APPROVE,
          isTest: true,
        }),
      ),
      attempt(() =>
        approveDraftSubjectForScope(ownerApproveScope, {
          draftId: draftOne.draftId,
          variantId: variantOne.id,
          confirmedDigest: variantOne.digest,
          actor: actorIdentity(OWNER_IDENTITY, "client_owner"),
          now: NOW_APPROVE,
          isTest: true,
        }),
      ),
    ]);
    const approvalResults = racedApprovals.map((entry) => (entry.threw ? { ok: false, reason: entry.error } : entry.value));
    const acceptedApprovals = approvalResults.filter((entry) => entry.ok === true);
    const refusedApprovals = approvalResults.filter((entry) => entry.ok === false);
    check(
      "C1 EXACTLY ONE OF THE TWO IS ACCEPTED — two people pressing Approve at the same moment is one approval, not two",
      acceptedApprovals.length === 1,
      `${String(acceptedApprovals.length)} accepted, ${String(refusedApprovals.length)} refused`,
    );
    check(
      "C2 the loser is refused IN WORDS (the item moved while the approval was being recorded), never a crash and never silence",
      refusedApprovals.length === 1 &&
        /read the draft again|not a legal move/.test(reason(refusedApprovals[0] ?? { ok: true })),
      reason(refusedApprovals[0] ?? { ok: true }).slice(0, 160),
    );
    const afterRace = await itemRow(draftOne.itemId);
    const raceApprovalRows = await approvalRows(draftOne.itemId);
    check(
      "C3 the DATABASE holds ONE approval row, one version bump and the stored digest of the stored bytes — read back, not returned",
      raceApprovalRows.length === 1 &&
        Number(afterRace?.approval_version) === 1 &&
        txt(afterRace?.status) === "approved" &&
        txt(afterRace?.approved_digest) === contentDigest(txt(afterRace?.title), txt(afterRace?.body)) &&
        [MANAGER_IDENTITY, OWNER_IDENTITY].includes(txt(afterRace?.approved_by)),
      `rows=${String(raceApprovalRows.length)} version=${txt(afterRace?.approval_version)} by=${txt(afterRace?.approved_by)}`,
    );
    check(
      "C4 and the one approval covers exactly the variant digest on disk, so nothing was approved that is not stored",
      JSON.stringify(listOf(afterRace?.approved_variant_digests)) === JSON.stringify([variantOne.recomputed]),
      listOf(afterRace?.approved_variant_digests).join(",") || "none",
    );
    const queueAfterRace = await listApprovalQueueForScope(viewScope, { now: NOW_APPROVE });
    const racedEntry = queueAfterRace.entries.find((entry) => entry.itemId === draftOne.itemId);
    check(
      "C5 the queue derives the same single approval from stored facts (the read the UI shows agrees with the race's outcome)",
      racedEntry?.state === "approved" && racedEntry.because.includes("approval version 1"),
      `${String(racedEntry?.state)} — ${String(racedEntry?.because).slice(0, 100)}`,
    );

    section("C6. an approval racing an EDIT of the same draft");
    const draftTwo = await draftFor(createScope, CLEAN_IDEA);
    const variantTwo = await facebookVariant(draftTwo.draftId);
    await submitDraftForApprovalForScope(editScope, { itemId: draftTwo.itemId, now: NOW_SUBMIT });
    const racedEdit = await Promise.all([
      attempt(() =>
        approveDraftSubjectForScope(approveScope, {
          draftId: draftTwo.draftId,
          variantId: variantTwo.id,
          confirmedDigest: variantTwo.digest,
          actor: actorIdentity(MANAGER_IDENTITY, "client_manager"),
          now: NOW_APPROVE,
          isTest: true,
        }),
      ),
      attempt(() =>
        editDraftForScope(editScope, {
          draftId: draftTwo.draftId,
          title: "Saturday morning hours",
          body: "We are open Saturday morning for oil changes, brakes and routine service. Call the shop to book a time.",
          cta: "Call the shop",
          actor: actorIdentity(MARKETING_IDENTITY, "client_marketing"),
          now: NOW_EDIT,
          isTest: true,
        }),
      ),
    ]);
    const editOutcomes = racedEdit.map((entry) => (entry.threw ? { ok: false, reason: entry.error } : entry.value));
    const itemTwo = await itemRow(draftTwo.itemId);
    const itemTwoDigest = contentDigest(txt(itemTwo?.title), txt(itemTwo?.body));
    const itemTwoVariant = await facebookVariant(draftTwo.draftId);
    const approvedOverOtherBytes = txt(itemTwo?.status) === "approved" && txt(itemTwo?.approved_digest) !== itemTwoDigest;
    check(
      "C7 whatever order the two land in, the item never stands APPROVED over bytes its approval does not name",
      approvedOverOtherBytes === false,
      `status=${txt(itemTwo?.status)} stored=${itemTwoDigest} approved=${txt(itemTwo?.approved_digest)}`,
    );
    check(
      "C8 and if it does stand approved, the approved variant digest is the digest of the variant stored now (recomputed from the row)",
      txt(itemTwo?.status) !== "approved" ||
        (JSON.stringify(listOf(itemTwo?.approved_variant_digests)) === JSON.stringify([itemTwoVariant.recomputed]) &&
          itemTwoVariant.digest === itemTwoVariant.recomputed),
      `approved=${txt(itemTwo?.status)} variants=${listOf(itemTwo?.approved_variant_digests).join(",") || "none"}`,
    );
    /*
     * COUNTED OVER `action = 'approve'` ROWS ONLY, and that is the honest measure rather than a
     * convenience: `content_draft_approvals` is the ACT LOG, so the edit that overtook the approval
     * writes its own current row there (action `edit`). What this check is about is the number of
     * approvals that still stand — one when the item is approved, none when the edit voided it —
     * so the log's other acts are not counted as approvals.
     */
    const currentApprovalsTwo = (await approvalRows(draftTwo.itemId)).filter(
      (row) => row.invalidated_at === null && txt(row.action) === "approve",
    );
    const approvedTwo = txt(itemTwo?.status) === "approved";
    check(
      "C9 exactly ONE approval stands current when the item is approved and NONE when the edit voided it — never two live approvals",
      currentApprovalsTwo.length === (approvedTwo ? 1 : 0) &&
        editOutcomes.some((entry) => entry.ok === true) &&
        !racedEdit.some((entry) => entry.threw),
      `${String(currentApprovalsTwo.length)} current approval(s) with the item ${txt(itemTwo?.status)}; edit ${
        editOutcomes[1]?.ok === true ? "accepted" : "refused"
      }`,
    );

    /* --------------------------------------- D. the same webhook, delivered at once */
    section("D. one provider message delivered three times at the same instant");
    const smsId = `sms_phase5_race_${randomUUID()}`;
    const payload = inboundPayload(smsId, "We are open Saturday 9 to 12 for walk-ins. Come by for a coffee.");
    const deliveries = await Promise.all(
      [0, 1, 2].map(() =>
        attempt(() => {
          const headers = signedHeaders(payload, smsId);
          return inboundSmsRequestOutcome(postInbound(payload, headers), { isTest: true });
        }),
      ),
    );
    const delivered = deliveries.map((entry) =>
      entry.threw ? { status: 0, body: { threw: entry.error }, detail: entry.error, confirmation: null } : entry.value,
    );
    check(
      "D1 NONE OF THE THREE THROWS, and all three get the one accepted answer — a simultaneous re-delivery is not an error the provider should retry",
      deliveries.every((entry) => entry.threw === false) &&
        delivered.every(
          (entry) => entry.status === 202 && JSON.stringify(entry.body) === JSON.stringify(INBOUND_SMS_ACCEPTED_BODY),
        ),
      delivered.map((entry) => `${String(entry.status)}`).join("/"),
    );
    const messageRows = await rows(
      `select id, processing_status, content_item_id from inbound_messages where organization_id = $1::uuid and external_message_id = $2::text`,
      [ORG_A, smsId],
    );
    const itemsFromSms = await rows(
      `select id from content_items where organization_id = $1::uuid and created_by like 'inbound-sms:%'`,
      [ORG_A],
    );
    const draftsFromSms = await rows(
      `select d.id from content_item_drafts d join content_items i on i.id = d.content_item_id
        where i.organization_id = $1::uuid and i.created_by like 'inbound-sms:%'`,
      [ORG_A],
    );
    check(
      "D2 the workspace holds exactly ONE message row, ONE content item and ONE draft for those three deliveries",
      messageRows.length === 1 && itemsFromSms.length === 1 && draftsFromSms.length === 1,
      `${String(messageRows.length)} message(s), ${String(itemsFromSms.length)} item(s), ${String(draftsFromSms.length)} draft(s)`,
    );
    const attempts = delivered.filter((entry) => entry.confirmation !== null);
    check(
      "D3 AT MOST ONE confirmation was even attempted — a re-delivered webhook never sends the client a second text",
      attempts.length <= 1 && String(messageRows[0]?.processing_status) === "drafted",
      `${String(attempts.length)} confirmation attempt(s) · status=${String(messageRows[0]?.processing_status)}`,
    );
    const sequentialAgain = await inboundSmsRequestOutcome(postInbound(payload, signedHeaders(payload, smsId)), { isTest: true });
    check(
      "D4 a fourth, sequential delivery is still recognised as a duplicate: nothing new written, nothing new sent",
      sequentialAgain.status === 202 &&
        sequentialAgain.confirmation === null &&
        sequentialAgain.detail.includes("duplicate") &&
        (await count(`select count(*)::int as count from inbound_messages where organization_id = $1::uuid and external_message_id = $2::text`, [ORG_A, smsId])) === 1,
      sequentialAgain.detail.slice(0, 120),
    );
    const secondSmsId = `sms_phase5_second_${randomUUID()}`;
    const secondPayload = inboundPayload(secondSmsId, "Second idea: free parking on Sundays.");
    const secondDelivery = await inboundSmsRequestOutcome(postInbound(secondPayload, signedHeaders(secondPayload, secondSmsId)), {
      isTest: true,
    });
    check(
      "D5 the guard is per provider message, not 'one message per sender for ever': a NEW id from the same number drafts its own item",
      secondDelivery.status === 202 &&
        (await count(`select count(*)::int as count from inbound_messages where organization_id = $1::uuid and external_message_id = $2::text`, [ORG_A, secondSmsId])) === 1 &&
        (await count(`select count(*)::int as count from content_items where organization_id = $1::uuid and created_by like 'inbound-sms:%'`, [ORG_A])) === 2,
      `${String(await count(`select count(*)::int as count from content_items where organization_id = $1::uuid and created_by like 'inbound-sms:%'`, [ORG_A]))} item(s) from two messages`,
    );

    /* ------------------------------- E. the same publication recorded at once */
    section("E. one publication fact recorded twice at the same instant");
    const failedFact = {
      itemId: draftOne.itemId,
      channel: "facebook",
      status: "failed",
      url: null,
      publishedAt: null,
      publishedBy: "TEST — publisher",
      evidence: { kind: "publisher-note" as const, reference: null, note: "TEST — the platform refused the post: media upload rejected", captured_at: null },
    };
    const racedFailures = await Promise.all([
      attempt(() => recordPublicationForScope(publishScope, { ...failedFact })),
      attempt(() => recordPublicationForScope(publishScope, { ...failedFact })),
    ]);
    const failureResults = racedFailures.map((entry) => (entry.threw ? { ok: false, reason: entry.error, appended: false } : entry.value));
    const storedAfterFailures = await itemRow(draftOne.itemId);
    const storedPublications = Array.isArray(storedAfterFailures?.publications)
      ? (storedAfterFailures?.publications as Record<string, unknown>[])
      : [];
    check(
      "E1 the same failed fact recorded twice at once is ONE entry on the record, read back from the item row",
      storedPublications.length === 1,
      `${String(storedPublications.length)} entr(ies); outcomes ${failureResults.map((entry) => (entry.ok ? "ok" : "refused")).join("/")}`,
    );
    const failedEntry = storedPublications[0] ?? {};
    check(
      "E2 a FAILED publication carries no address and no moment, carries the channel's own error words, and ties to the item's real approval version",
      txt(failedEntry.status) === "failed" &&
        (failedEntry.url === null || failedEntry.url === undefined) &&
        (failedEntry.published_at === null || failedEntry.published_at === undefined) &&
        Number(failedEntry.approval_version) === Number(storedAfterFailures?.approval_version) &&
        txt((failedEntry.evidence as Record<string, unknown> | null)?.note).includes("media upload rejected"),
      `status=${txt(failedEntry.status)} url=${String(failedEntry.url)} version=${String(failedEntry.approval_version)}`,
    );
    check(
      "E3 a failure never moves the item to published — the record says what happened, the item keeps its own state",
      txt(storedAfterFailures?.status) === "approved" && storedAfterFailures?.published_at === null,
      `status=${txt(storedAfterFailures?.status)} published_at=${String(storedAfterFailures?.published_at)}`,
    );
    check(
      "E4 and every loser was refused in words (read the item again) or told the fact was already logged — never a silent drop",
      failureResults.every((entry) =>
        entry.ok === true ? true : /read the item again|already/.test(String((entry as { reason?: string }).reason ?? "")),
      ),
      failureResults.map((entry) => (entry.ok ? "ok" : String((entry as { reason?: string }).reason ?? "").slice(0, 60))).join(" | "),
    );

    const successFact = {
      itemId: draftOne.itemId,
      channel: "facebook",
      status: "published",
      url: "https://www.facebook.com/TEST-phase5-fixture/posts/1",
      publishedAt: PUBLISHED_AT,
      publishedBy: "TEST — publisher",
      evidence: { kind: "page-url" as const, reference: "https://www.facebook.com/TEST-phase5-fixture/posts/1", note: null, captured_at: PUBLISHED_AT },
    };
    const racedDifferent = await Promise.all([
      attempt(() => recordPublicationForScope(publishScope, { ...failedFact, evidence: { kind: "console-log" as const, reference: null, note: "TEST — second attempt also refused by the platform", captured_at: null } })),
      attempt(() => recordPublicationForScope(publishScope, { ...successFact })),
    ]);
    const differentResults = racedDifferent.map((entry) => (entry.threw ? { ok: false, reason: entry.error } : entry.value));
    const afterDifferent = await itemRow(draftOne.itemId);
    const finalPublications = Array.isArray(afterDifferent?.publications)
      ? (afterDifferent?.publications as Record<string, unknown>[])
      : [];
    check(
      "E5 two DIFFERENT facts recorded at once land as ONE more entry — the loser is refused with 'read the item again' rather than lost",
      finalPublications.length === 2 &&
        differentResults.filter((entry) => entry.ok === true).length >= 1 &&
        differentResults.every((entry) =>
          entry.ok === true ? true : /read the item again|already/.test(String((entry as { reason?: string }).reason ?? "")),
        ),
      `${String(finalPublications.length)} entr(ies); ${differentResults.map((entry) => (entry.ok ? "ok" : "refused")).join("/")}`,
    );
    const successStored = finalPublications.find((entry) => txt(entry.status) === "published");
    check(
      "E6 a success entry carries the address and the moment the publisher reported, and neither is invented for it",
      successStored === undefined ||
        (txt(successStored.url) === successFact.url && iso(successStored.published_at) === PUBLISHED_AT),
      successStored === undefined
        ? "the refused arm is the one that lost; nothing claims a post went out"
        : `url=${txt(successStored.url)} at=${iso(successStored.published_at)}`,
    );
    check(
      "E7 and the item is still never moved to published by logging a publication — the store records, the transition moves",
      txt(afterDifferent?.status) === "approved",
      `status=${txt(afterDifferent?.status)}`,
    );
  } finally {
    await closeDatabase().catch(() => {});
    try {
      await admin.unsafe("select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()", [name]);
      await admin.unsafe(`drop database if exists ${name}`);
      console.log(`\nscratch database ${name} dropped`);
    } catch (error) {
      console.error(`could not drop the scratch database ${name}: ${(error as Error).message}`);
    }
    await admin.end({ timeout: 5 }).catch(() => {});
  }
  console.log(`\nverify:t2p-phase5 — ${String(passed)} passed, ${String(failed)} failed`);
  if (failed > 0) {
    for (const line of failureLines) console.log(`  ${line}`);
    process.exit(1);
  }
}
await main();
