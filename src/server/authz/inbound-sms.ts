/**
 * THE INBOUND SMS INGEST PATH — Text-to-Post phase 3 (Bird), the write half.
 *
 * WHAT ARRIVES HERE: a message the provider already verified the signature of, already parsed, with
 * its sender address normalized. What this module decides is the only thing that matters:
 *
 *   WHO IS THIS, AND MAY THEY SEND US CONTENT? The match is against
 *   `authorized_inbound_identities` (migration 0028) — the store the data-foundation slice already
 *   built for exactly this, so no new table and no new column was needed. A row must be an `sms`
 *   identity, VERIFIED, not opted out, and still allowed to submit content. Anything else is not a
 *   match, and a non-match WRITES NOTHING AT ALL: there is no tenant row to attribute an
 *   unattributable message to (`inbound_messages.organization_id` is NOT NULL, which is the
 *   schema's own way of saying the same thing).
 *
 *   AMBIGUITY IS A REFUSAL, NOT A GUESS. The unique index is per (organization, channel, address),
 *   so the same phone number can legitimately be a contact for two different businesses. When two
 *   workspaces both claim the number, this path drafts NOTHING: choosing one would put a client's
 *   words in another client's workspace. Our own number-to-workspace mapping (which a provisioned
 *   number would give us) is the honest way to disambiguate, and it does not exist yet.
 *
 *   A DELIVERY IS NOT AN APPROVAL. A matched message becomes ONE draft content item, through the
 *   ordinary content path (`createContentItemForScope`), with a version-1 draft row so a person can
 *   actually approve it. NOTHING here publishes, schedules, approves or sends: the item's own state
 *   machine starts it at `draft`, and the approval that would let it out of the building is a
 *   different right (`content.approve`) held by a person.
 *
 *   A REPEATED DELIVERY DRAFTS NOTHING A SECOND TIME. The provider's own message id is unique per
 *   (organization, channel) in `inbound_messages`, so a re-delivered webhook resolves to the row we
 *   already have and this path reports the repeat instead of writing a second draft.
 *
 *   MISSING IS MISSING. A message with no text stores NULL — never "". A media-only message is
 *   recorded as a message with a count and NO draft, because this build fetches no MMS attachment
 *   and a caption invented from a photo nobody looked at would be a fabrication. A message with
 *   neither text nor media is refused before any insert (the schema requires one of the two).
 *
 * WHAT IS NEVER STORED: no credential, no card data, no patient information by design, and nothing
 * from another organization. Every statement below is keyed by `organization_id`, and the tenant SQL
 * lives here because `src/server/authz/` is the one allowlisted place for it (`bun run check:scope`).
 */
import { sql, type DbRow } from '~/db';
import { INBOUND_SMS_CHANNEL } from '~/config/t2p-sms';
import { createContentItemForScope, CONTENT_CREATE_PERMISSION } from './content';
import { contentDigest } from '../content/state';
import { PLATFORM_SPECS, isSocialAccountPlatform } from '../content/platforms';
import type { ContentChannel, ContentTarget, SourceRef } from '../content/types';
import type { OrganizationScope } from './types';

/** How many connected accounts one ingest reads when choosing where a draft is aimed. */
export const INBOUND_SMS_CHANNEL_LIMIT = 5;

export interface InboundSmsSender {
  identityId: string;
  organizationId: string;
  locationId: string | null;
  /** What the client calls this person, when they told us. Null is ordinary. */
  displayName: string | null;
}

export type InboundSmsMatch =
  | { matched: true; sender: InboundSmsSender }
  | { matched: false; reason: string };

/**
 * WHICH WORKSPACE OWNS THIS NUMBER, and whether it may send us content.
 *
 * A refusal says why in OUR words (it goes to the log, never to the caller — see the endpoint's
 * constant answer): no row for this number, a row that is not verified, a row that opted out, a row
 * whose content permission was withdrawn, or a number two workspaces both claim.
 */
export async function matchInboundSmsSender(addressNormalized: string): Promise<InboundSmsMatch> {
  const rows = (await sql().query(
    `select id, organization_id, location_id, display_name, verification_state, messaging_opt_out, may_submit_content
       from authorized_inbound_identities
      where channel = $1::text and address = $2::text
      limit 5`,
    [INBOUND_SMS_CHANNEL, addressNormalized],
  )) as unknown as DbRow[];
  if (rows.length === 0) {
    return { matched: false, reason: 'no authorized inbound identity holds this number' };
  }
  if (rows.length > 1) {
    return {
      matched: false,
      reason: `${String(rows.length)} workspaces claim this number, and this build has no number-to-workspace mapping to tell them apart`,
    };
  }
  const row = rows[0] as DbRow;
  if (String(row.verification_state) !== 'verified') {
    return { matched: false, reason: `the identity for this number is ${String(row.verification_state)}, and only a verified identity may send content` };
  }
  if (row.messaging_opt_out === true) {
    return { matched: false, reason: 'this number has opted out of messages from us' };
  }
  if (row.may_submit_content !== true) {
    return { matched: false, reason: 'content submission was withdrawn for this number' };
  }
  return {
    matched: true,
    sender: {
      identityId: String(row.id),
      organizationId: String(row.organization_id),
      locationId: row.location_id === null || row.location_id === undefined ? null : String(row.location_id),
      displayName: row.display_name === null || row.display_name === undefined ? null : String(row.display_name),
    },
  };
}

/**
 * THE SCOPE THIS PATH ACTS UNDER. Minted from the STORED identity row the match resolved to — never
 * from the request, which supplies nothing but a phone number. The two identity fields name the row
 * rather than a person (a webhook has no signed-in human behind it), prefixed so nothing downstream
 * can read either value as a membership or a user id; `requireScope()` still checks the shape, so a
 * scope minted here is validated like any other, and the permission it carries is the one the write
 * needs (`record.create`).
 */
function scopeForSender(sender: InboundSmsSender): OrganizationScope {
  const authority = `inbound-identity:${sender.identityId}`;
  return {
    kind: 'organization',
    organizationId: sender.organizationId,
    locationIds: sender.locationId === null ? 'all' : [sender.locationId],
    membershipId: authority,
    userId: authority,
    roleKey: 'inbound-sms',
    permission: CONTENT_CREATE_PERMISSION,
    requestedLocationId: sender.locationId,
  };
}

/**
 * WHERE A DRAFT FROM A TEXT MESSAGE IS AIMED. The channels of the accounts this workspace actually
 * has connected, in the platform→channel map's own pairing (`../content/platforms.ts` — the one
 * module that names a platform; no platform id is spelled here). A workspace with nothing connected
 * has no target, and a post with nowhere to go is not a draft: that case is recorded as a message
 * with no draft and a reason, not as an item aimed at a channel nobody authorized.
 */
async function connectedChannels(organizationId: string): Promise<ContentChannel[]> {
  const rows = (await sql().query(
    `select platform
       from social_account_connections
      where organization_id = $1::uuid and status = 'connected'
      order by platform asc
      limit $2::int`,
    [organizationId, INBOUND_SMS_CHANNEL_LIMIT],
  )) as unknown as DbRow[];
  const channels: ContentChannel[] = [];
  for (const row of rows) {
    const platform = String(row.platform ?? '');
    if (!isSocialAccountPlatform(platform)) continue;
    const channel = PLATFORM_SPECS[platform].channel;
    if (!channels.includes(channel)) channels.push(channel);
  }
  return channels;
}

export interface InboundSmsIngestInput {
  /** The sender, exactly as the provider handed it over. Stored verbatim as evidence. */
  senderAddressRaw: string;
  /** The E.164 form the match uses. */
  senderAddressNormalized: string;
  /** What they wrote, verbatim, or null when the message carried no text. */
  text: string | null;
  /** How many media files the delivery declared. Not fetched by this build; see the header. */
  mediaCount: number;
  /** The provider's own message id, for refusing a re-delivery. */
  externalMessageId: string | null;
  /** When the provider says it arrived, or null. */
  receivedAt: string | null;
  /** Our own number that received it, verbatim, or null. */
  ourNumberRaw: string | null;
  /** True for synthetic traffic (the verification suite). Labelled, never inferred from content. */
  isTest?: boolean;
  /** Injected by the suite so a stored row can be asserted at a known moment. */
  now?: string;
}

/**
 * WHAT HAPPENED TO ONE DELIVERY. `drafted` — a draft item exists and waits for a person.
 * `recorded` — the message is stored and NO draft was written; `reason` says why in words.
 * `duplicate` — the provider delivered a message we already hold; nothing new was written.
 * `not-attributed` — the sender is not an authorized identity here, so NOTHING was written anywhere.
 */
export type InboundSmsIngestOutcome =
  | {
      kind: 'drafted' | 'recorded' | 'duplicate';
      organizationId: string;
      identityId: string;
      messageId: string;
      contentItemId: string | null;
      draftId: string | null;
      /** The sender's number, E.164, for the best-effort confirmation. */
      replyTo: string;
      /** Always present, always true: the sentence the log and the suite print. */
      statement: string;
      /** Present on `recorded`: why no draft was written. */
      reason?: string;
    }
  | { kind: 'not-attributed'; reason: string };

/** The message row we already hold for this provider id, if we hold one. */
async function existingMessage(
  organizationId: string,
  externalMessageId: string,
): Promise<{ id: string; contentItemId: string | null } | null> {
  const rows = (await sql().query(
    `select id, content_item_id
       from inbound_messages
      where organization_id = $1::uuid and channel = $2::text and external_message_id = $3::text
      limit 1`,
    [organizationId, INBOUND_SMS_CHANNEL, externalMessageId],
  )) as unknown as DbRow[];
  const row = rows[0];
  if (row === undefined) return null;
  return {
    id: String(row.id),
    contentItemId: row.content_item_id === null || row.content_item_id === undefined ? null : String(row.content_item_id),
  };
}

const INSERT_MESSAGE_SQL = `insert into inbound_messages (
  organization_id, location_id, channel, sender_identity_id, sender_address_raw, raw_text,
  media_count, external_message_id, processing_status, received_at, is_test
) values (
  $1::uuid, $2::uuid, $3::text, $4::uuid, $5::text, $6::text,
  $7::int, $8::text, $9::text, coalesce($10::timestamptz, now()), $11::boolean
) returning id`;

const INSERT_DRAFT_SQL = `with inserted as (
  insert into content_item_drafts (
    organization_id, content_item_id, version, is_primary, title, body, cta, hashtags, status,
    ai_drafted, draft_label, source_refs, assumptions, digest, created_by, source_message_id
  ) values (
    $1::uuid, $2::uuid, $3::int, $4::boolean, $5::text, $6::text, $7::text, $8::text[], $9::text,
    $10::boolean, $11::text, $12::jsonb, $13::jsonb, $14::text, $15::text, $16::uuid
  ) returning id
), linked as (
  update content_items i set current_draft_version = $3::int, updated_at = now()
    from inserted d
   where i.organization_id = $1::uuid and i.id = $2::uuid
   returning i.id
)
select (select id from inserted) as id, (select count(*)::int from linked) as linked_count`;

/** The first line of what they wrote, bounded, as the item's title. Never invented text. */
function titleFromText(text: string): string {
  const firstLine = (text.split('\n')[0] ?? '').trim();
  const base = firstLine === '' ? text.trim() : firstLine;
  return base.length > 120 ? `${base.slice(0, 117)}...` : base;
}

/** Record the outcome of a message that produced no draft, in words, on the row itself. */
async function markMessage(
  organizationId: string,
  messageId: string,
  status: 'ignored' | 'declined',
  reason: string,
): Promise<void> {
  await sql().query(
    `update inbound_messages
        set processing_status = $3::text, refusal_reason = $4::text, updated_at = now()
      where organization_id = $1::uuid and id = $2::uuid`,
    [organizationId, messageId, status, reason],
  );
}

/**
 * ONE DELIVERY, TAKEN AS FAR AS IT HONESTLY GOES. The order is deliberate:
 *   1. match the sender (nothing is written for a non-match);
 *   2. resolve a repeat delivery (nothing is written a second time);
 *   3. write the message row — the evidence of what arrived, before anything is derived from it;
 *   4. read where a draft could go, and either write exactly one draft item + its version-1 draft
 *      row, or mark the message with the reason there is no draft;
 *   5. report, including the E.164 number a confirmation may be sent to. WHETHER THE CONFIRMATION
 *      GOES OUT IS NOT THIS MODULE'S BUSINESS, and nothing about it can change what was written.
 */
/**
 * THE DUPLICATE ANSWER, in one place, because there are now two ways to arrive at it: a delivery
 * that arrives after the row is committed (the read in step 2 finds it) and one that arrives while
 * the first is still being written (the unique index refuses the second insert). Both must say the
 * same thing, and neither may write anything.
 */
function duplicateOutcome(
  sender: { organizationId: string; identityId: string },
  known: { id: string; contentItemId: string | null },
  replyTo: string,
): InboundSmsIngestOutcome {
  return {
    kind: 'duplicate',
    organizationId: sender.organizationId,
    identityId: sender.identityId,
    messageId: known.id,
    contentItemId: known.contentItemId,
    draftId: null,
    replyTo,
    statement: `This delivery repeats message ${known.id}, which this workspace already holds: nothing new was written and no second confirmation is sent.`,
  };
}

export async function ingestInboundSms(input: InboundSmsIngestInput): Promise<InboundSmsIngestOutcome> {
  const match = await matchInboundSmsSender(input.senderAddressNormalized);
  if (!match.matched) return { kind: 'not-attributed', reason: match.reason };
  const sender = match.sender;

  if (input.externalMessageId !== null) {
    const known = await existingMessage(sender.organizationId, input.externalMessageId);
    if (known !== null) return duplicateOutcome(sender, known, input.senderAddressNormalized);
  }

  let inserted: DbRow[];
  try {
    inserted = (await sql().query(INSERT_MESSAGE_SQL, [
      sender.organizationId,
      sender.locationId,
      INBOUND_SMS_CHANNEL,
      sender.identityId,
      input.senderAddressRaw,
      input.text,
      input.mediaCount,
      input.externalMessageId,
      'received',
      input.receivedAt,
      input.isTest === true,
    ])) as unknown as DbRow[];
  } catch (error) {
    /*
     * THE SAME PROVIDER MESSAGE, DELIVERED AGAIN WHILE THE FIRST WAS STILL BEING WRITTEN. Step 2
     * read no row because the other delivery had not committed yet, so the decision falls to the
     * unique index on (organization_id, channel, external_message_id) — and it refuses this insert.
     * That is a duplicate, and it is answered as one: the row is re-read and nothing is written.
     * If the row is NOT there afterwards then this was some other failure, and it is not ours to
     * swallow — it is rethrown exactly as it came.
     */
    const raced =
      input.externalMessageId === null ? null : await existingMessage(sender.organizationId, input.externalMessageId);
    if (raced === null) throw error;
    return duplicateOutcome(sender, raced, input.senderAddressNormalized);
  }
  const messageId = String(inserted[0]?.id ?? '');
  if (messageId === '') throw new Error('[inbound-sms] the message row was not written, so nothing here can be reported as recorded');

  if (input.text === null) {
    await markMessage(
      sender.organizationId,
      messageId,
      'ignored',
      `A media-only message (${String(input.mediaCount)} file(s) declared). This build fetches no message attachment, so no draft was written and no caption was invented from a file nobody has looked at.`,
    );
    return {
      kind: 'recorded',
      organizationId: sender.organizationId,
      identityId: sender.identityId,
      messageId,
      contentItemId: null,
      draftId: null,
      replyTo: input.senderAddressNormalized,
      reason: 'the message carried no text, so there was nothing to draft from',
      statement: `Recorded message ${messageId} with no text and ${String(input.mediaCount)} declared file(s); no draft was written.`,
    };
  }

  const channels = await connectedChannels(sender.organizationId);
  if (channels.length === 0) {
    await markMessage(
      sender.organizationId,
      messageId,
      'ignored',
      'This workspace has no connected account, so a draft would have no publication target: nothing was drafted and nothing is scheduled.',
    );
    return {
      kind: 'recorded',
      organizationId: sender.organizationId,
      identityId: sender.identityId,
      messageId,
      contentItemId: null,
      draftId: null,
      replyTo: input.senderAddressNormalized,
      reason: 'this workspace has no connected account to aim a post at',
      statement: `Recorded message ${messageId} and wrote no draft: the workspace has no connected account.`,
    };
  }

  const scope = scopeForSender(sender);
  const body = input.text;
  const title = titleFromText(body);
  /*
   * THE DRAFT IS BUILT ON THE CLIENT'S OWN SUBMISSION, and that is the whole of its evidence: no
   * finding of ours is cited because none was produced for this text, and the assumption line says
   * in words who sent it, when it arrived and that the channels below are the accounts the
   * workspace has connected rather than a choice anybody made about this post.
   */
  const sentBy = sender.displayName === null ? input.senderAddressRaw : sender.displayName;
  const assumptions = [
    `Sent to BravData as a text message by ${sentBy} (${input.senderAddressRaw}), received ${input.receivedAt ?? 'at a moment the provider did not state'}. The words below are the sender's own, stored verbatim.`,
    `No person has chosen a destination for this post. It is aimed at the ${String(channels.length)} channel(s) this workspace has connected: ${channels.join(', ')}.`,
    'A text message is a request to draft, never an approval: nothing here is published or scheduled, and it waits for a person.',
  ];
  const sourceRefs: SourceRef[] = [];
  const written = await createContentItemForScope(scope, {
    kind: 'social',
    title,
    body,
    targetChannels: channels.map((channel) => ({ channel, account: null }) satisfies ContentTarget),
    aiDrafted: false,
    draftLabel: null,
    sourceRefs,
    assumptions,
    createdBy: `inbound-sms:${messageId}`,
    locationId: sender.locationId,
  });
  if (!written.ok) {
    // The content store refused the text (its wording audit, a length, a channel). That is a real
    // refusal and it is recorded as one, with the store's own sentence, rather than worked around.
    await markMessage(sender.organizationId, messageId, 'declined', written.reason);
    return {
      kind: 'recorded',
      organizationId: sender.organizationId,
      identityId: sender.identityId,
      messageId,
      contentItemId: null,
      draftId: null,
      replyTo: input.senderAddressNormalized,
      reason: written.reason,
      statement: `Recorded message ${messageId} and drafted nothing: the content store refused the text \u2014 ${written.reason}`,
    };
  }

  const itemId = written.item.id;
  const draftRows = (await sql().query(INSERT_DRAFT_SQL, [
    sender.organizationId,
    itemId,
    1,
    true,
    title,
    body,
    null,
    [] as unknown as string,
    'proposed',
    false,
    null,
    sourceRefs as unknown as string,
    assumptions as unknown as string,
    contentDigest(title, body),
    `inbound-sms:${messageId}`,
    messageId,
  ])) as unknown as DbRow[];
  const draftId = String(draftRows[0]?.id ?? '');
  const linked = Number(draftRows[0]?.linked_count ?? 0);
  if (draftId === '' || linked !== 1) {
    throw new Error(
      '[inbound-sms] the draft row and the item\u2019s pointer to it were not written together, so the item does not name the text this path stored: nothing is reported as drafted',
    );
  }

  await sql().query(
    `update inbound_messages
        set processing_status = $3::text, content_item_id = $4::uuid, updated_at = now()
      where organization_id = $1::uuid and id = $2::uuid`,
    [sender.organizationId, messageId, 'drafted', itemId],
  );

  return {
    kind: 'drafted',
    organizationId: sender.organizationId,
    identityId: sender.identityId,
    messageId,
    contentItemId: itemId,
    draftId,
    replyTo: input.senderAddressNormalized,
    statement: `Drafted message ${messageId} as content item ${itemId} (draft ${draftId}). Nothing is approved, scheduled or published; it waits for a person.`,
  };
}

/**
 * WHETHER THIS DEPLOYMENT'S OWN SUBMISSION TABLE IS READABLE. A delivery that cannot be stored
 * must not be answered as if it had been, so the endpoint asks this before it starts. The query is
 * here because it is SQL over a tenant table and this module is the allowlisted place for it.
 */
export async function inboundSmsStorageReady(): Promise<boolean> {
  try {
    await sql().query("select 1 from inbound_messages limit 1");
    return true;
  } catch {
    return false;
  }
}

/** What the queue shows for one stored submission. Read-only, tenant-scoped, no counting tricks. */
export interface InboundSmsMessageRow {
  messageId: string;
  rawText: string | null;
  mediaCount: number;
  status: string;
  refusalReason: string | null;
  contentItemId: string | null;
  receivedAt: string;
  isTest: boolean;
}

/**
 * THE MESSAGES THIS WORKSPACE HOLDS, newest first, for a person to look at. `organizationId` is
 * passed explicitly rather than read from a scope, because the two callers of this slice are a
 * webhook (no session) and the suite; every statement is still keyed by that one organization.
 */
export async function listInboundSmsForOrganization(
  organizationId: string,
  limit = 20,
): Promise<InboundSmsMessageRow[]> {
  const rows = (await sql().query(
    `select id, raw_text, media_count, processing_status, refusal_reason, content_item_id, received_at, is_test
       from inbound_messages
      where organization_id = $1::uuid and channel = $2::text
      order by received_at desc, id asc
      limit $3::int`,
    [organizationId, INBOUND_SMS_CHANNEL, limit],
  )) as unknown as DbRow[];
  return rows.map((row) => ({
    messageId: String(row.id),
    rawText: row.raw_text === null || row.raw_text === undefined ? null : String(row.raw_text),
    mediaCount: Number(row.media_count ?? 0),
    status: String(row.processing_status),
    refusalReason: row.refusal_reason === null || row.refusal_reason === undefined ? null : String(row.refusal_reason),
    contentItemId: row.content_item_id === null || row.content_item_id === undefined ? null : String(row.content_item_id),
    receivedAt: new Date(String(row.received_at)).toISOString(),
    isTest: row.is_test === true,
  }));
}
