/**
 * ONE REAL BIRD EMAIL — a manual test harness. INTERNAL ONLY, for a person at a terminal.
 *
 *   bun run bird:email-test you@example.com
 *
 * WHAT IT DOES: sends exactly ONE email through `sendReportEmail` in `src/server/bird.ts` — the
 * same helper the free-check report email uses — to the address given on the command line, then
 * prints what Bird answered: its own message id and the status word the helper returned, or the
 * provider's own error text. Nothing else. No database write, no lead row, no funnel event, no
 * second attempt.
 *
 * WHAT IT REFUSES TO DO:
 *   * IT REFUSES TO RUN WITHOUT A KEY. With `BIRD_API_KEY` unset or blank it says so and stops
 *     before any client is built, so an unconfigured machine cannot reach the network at all.
 *   * IT NEVER PRINTS THE KEY. The helper already scrubs the key out of any error it returns, and
 *     this file never reads it into anything it prints.
 *   * IT NEVER CLAIMS DELIVERY. Bird's answer is an acceptance (a queue entry), not a handset or a
 *     mailbox. The success line says ACCEPTED FOR DELIVERY and says what it cannot know.
 *   * IT NEVER SENDS MORE THAN ONE. There is no loop, no retry flag and no batch mode. The helper's
 *     own single transport retry is the only repetition that can happen, and that is the SDK's.
 *
 * WHY IT EXISTS: the `sent` arm of `sendReportEmail` cannot be exercised by the verification
 * suites — a real acceptance needs the owner's live key and a mailbox that can receive. This is
 * the one command that produces that evidence, by hand, on purpose, and reports exactly what came
 * back. It is a test of the provider connection, not a marketing send: the message it composes is
 * a plain notice that a test was run, and it is sent under the `transactional` category the helper
 * already uses.
 *
 * EXIT CODES: 0 the message was accepted by Bird · 1 it was not (no key, bad address, or the
 * provider's refusal) · 2 the command line was wrong.
 */

import { business } from '../src/config/business';
import { SMS_ENV } from '../src/config/t2p-sms';
import { REPORT_EMAIL_FROM, sendReportEmail } from '../src/server/bird';

/** Deliberately loose: enough to catch a typo or a pasted phone number, not a validator. */
const ADDRESS_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function usage(): void {
  console.log('Usage: bun run bird:email-test <recipient@example.com>');
  console.log('');
  console.log('Sends ONE real email through the site\'s own Bird helper and prints what Bird answered.');
  console.log(`The sender is ${REPORT_EMAIL_FROM.name} <${REPORT_EMAIL_FROM.email}>.`);
  console.log(`Needs ${SMS_ENV.apiKey} in the environment, and that key must carry the emails:write scope.`);
}

function refuse(message: string, detail: string[] = []): void {
  console.log(`REFUSED: ${message}`);
  for (const line of detail) console.log(`  ${line}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exitCode = argv.length === 0 ? 2 : 0;
    return;
  }

  const to = (argv[0] ?? '').trim();
  if (to === '') {
    refuse('no recipient address was given.');
    usage();
    process.exitCode = 2;
    return;
  }
  if (!ADDRESS_SHAPE.test(to)) {
    refuse(`"${to}" does not look like an email address, so nothing was sent.`);
    process.exitCode = 2;
    return;
  }

  // Read once, only to decide whether to run. It is never printed, and it is not passed anywhere:
  // the helper reads the same setting itself.
  const apiKey = (process.env[SMS_ENV.apiKey] ?? '').trim();
  if (apiKey === '') {
    refuse(`${SMS_ENV.apiKey} is not set in this environment, so nothing was sent and no request was made.`, [
      `The helper returns "skipped" before it builds a client when ${SMS_ENV.apiKey} is blank.`,
      `Set ${SMS_ENV.apiKey} (with the emails:write scope) and run this again.`,
    ]);
    process.exitCode = 1;
    return;
  }

  const baseUrl = (process.env[SMS_ENV.baseUrl] ?? '').trim();
  const subject = `BravData email test — ${new Date().toISOString()}`;
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111">',
    `  <p><strong>This is a test message from ${business.name}.</strong></p>`,
    '  <p>Someone at BravData ran the site\'s own mail test. Bird accepted a message for this',
    '  address, which is all this proves: it is not a claim that anything reached a mailbox, and',
    '  nothing was added to a list.</p>',
    '  <p>If you were not expecting it, you can ignore it. Nothing is required of you.</p>',
    `  <p style="color:#555;font-size:13px">Sent from ${REPORT_EMAIL_FROM.email} · ${business.contact.location}</p>`,
    '</div>',
  ].join('\n');

  console.log(`Sending ONE email through the site's own Bird helper.`);
  console.log(`  from:    ${REPORT_EMAIL_FROM.name} <${REPORT_EMAIL_FROM.email}>`);
  console.log(`  to:      ${to}`);
  console.log(`  subject: ${subject}`);
  console.log(`  category: transactional`);
  if (baseUrl !== '') {
    console.log(`  NOTE: ${SMS_ENV.baseUrl} is set to ${baseUrl}, so the helper sends there, not to Bird's own API.`);
  }
  console.log('');

  const startedAt = Date.now();
  const outcome = await sendReportEmail({ to, subject, html });
  const elapsed = Date.now() - startedAt;

  if (outcome.status === 'sent') {
    console.log('Bird answered: ACCEPTED FOR DELIVERY.');
    console.log(`  message id: ${outcome.id ?? "(Bird's answer carried no id)"}`);
    console.log(`  status:     ${outcome.status} (provider: ${outcome.provider})`);
    console.log(`  took:       ${elapsed} ms`);
    console.log('');
    console.log('ACCEPTED is not delivered: Bird queued the message, and this command cannot see a mailbox.');
    process.exitCode = 0;
    return;
  }

  if (outcome.status === 'failed') {
    console.log("Bird refused it. The provider's own error, as the helper returns it:");
    console.log(`  ${outcome.reason}`);
    console.log(`  took: ${elapsed} ms`);
    console.log('');
    console.log('No message was accepted. Nothing is claimed as sent.');
    process.exitCode = 1;
    return;
  }

  console.log(`Nothing was sent. The helper skipped it: ${outcome.reason}`);
  process.exitCode = 1;
}

await main();
