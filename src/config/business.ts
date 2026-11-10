/**
 * Every business value BravData states in public lives here: pricing, plan
 * contents, what is excluded, turnaround targets, contact details and the policy
 * drafts' metadata. Change copy here, not in components.
 *
 * Two rules this file exists to enforce:
 *  - every price, fee and term is stated ONCE here and rendered from here, so no
 *    two pages can describe the same money differently;
 *  - nothing here may promise rankings, customer numbers or outcomes.
 *
 * The prices and fees are the owner's direction (pricing restructure, 2026-10-06),
 * so the copy does not hedge them as a "proposed launch default". What replaces
 * that hedge is the true statement of where a price becomes binding:
 * `terms.writtenAgreement`, rendered in the footer of every page, on /pricing and
 * in the Terms.
 */

/**
 * The version of the price list below. It is a date, not a semantic version: the
 * day the prices, fees and included ranges in this module were last set. Change
 * it whenever one of those numbers changes, so a quote, a report or a written
 * agreement can say which price list it was written against.
 */
export const PRICING_VERSION = "2026-10-06";

export interface Plan {
  /** Stable key: used in URLs, funnel captions and `planById`. Never change it. */
  id: string;
  name: string;
  /** The monthly price as a reader should see it, including any "From". */
  priceLabel: string;
  /** The same price in integer cents, for computation only. */
  priceMonthlyCents: number;
  /** True when the label is a starting price and the final quote can differ. */
  priceIsFrom: boolean;
  /** True when no list price applies and the work is scoped in a custom quote. */
  customQuote: boolean;
  /** The label on this plan's primary button. Rendered, never retyped. */
  cta: string;
  /** Where that button leads: a checkout step, a discussion, or sales contact. */
  ctaKind: "checkout" | "discuss" | "contact";
  /**
   * The Stripe subscription link this plan subscribes through, when there is one.
   *
   * Undefined means there is no self-service purchase for this plan and the
   * honest state is the conversation its `ctaKind` describes — never a stand-in
   * link, never another plan's link. The URL is a Stripe-hosted **Payment Link**
   * created in the owner's own Stripe account (live mode, 2026-10-06), so no
   * Stripe API call is ever made from this app and no Stripe secret key is needed
   * here: the purchase happens entirely on Stripe's page. See `checkout` below for
   * the terms that page cannot carry.
   */
  checkoutUrl?: string;
  recommended: boolean;
  recommendedLabel: string | null;
  /**
   * The one-time implementation fee for this plan, on its own terms.
   *
   * `status: "unconfigured"` means no figure has been confirmed for this plan. A
   * reader then sees an honest "to be confirmed", never another plan's fee and
   * never a zero — a missing fee is not a free fee.
   */
  implementationFee: {
    status: "configured" | "unconfigured";
    amountCents: number | null;
    label: string | null;
    /** The condition under which the fee is not charged, when there is one. */
    waiver: string | null;
  };
  /**
   * False means this plan's limits are not published yet. The pricing page then
   * shows "—" and says so; it never invents "unlimited".
   */
  limitsConfigured: boolean;
  /** The published limits of the plan, in the agreed wording. */
  limits: string[];
  summary: string;
  /** What the plan actually delivers, in the agreed wording. */
  includes: string[];
  /** One-line answer to "who is this for". */
  bestFor: string;
}

export const PLANS: Plan[] = [
  {
    id: "ai-visibility",
    name: "AI Visibility",
    priceLabel: "$697",
    priceMonthlyCents: 69700,
    priceIsFrom: false,
    customQuote: false,
    cta: "Choose AI Visibility",
    ctaKind: "checkout",
    checkoutUrl: "https://buy.stripe.com/cNidR8fXreqqaq227P0VO00",
    recommended: false,
    recommendedLabel: null,
    implementationFee: {
      status: "unconfigured",
      amountCents: null,
      label: null,
      waiver: null,
    },
    limitsConfigured: true,
    /**
     * "One location" is the limit /solutions/visibility's own FAQ has always
     * published ("Yes. AI Visibility covers one location"), while the price list
     * published no limit at all — so the sales page and the price list disagreed
     * (marketing copy audit item 4, 2026-10-08). The price list is the one place a
     * limit is stated, so the plan now carries the limit the sales page already
     * claimed. Nothing else is added: a limit nobody has agreed is not invented.
     */
    limits: ["One location"],
    summary: "For businesses that want to understand and improve their online presence.",
    bestFor: "A local business that wants to see and improve how it appears online.",
    includes: [
      "Client dashboard",
      "AI/search visibility observations through supported sources",
      "Google Business Profile and reputation monitoring where connected",
      "Competitor monitoring",
      "Prioritized recommendations",
      "Limited content support",
      "Monthly reporting",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    priceLabel: "$1,497",
    priceMonthlyCents: 149700,
    priceIsFrom: false,
    customQuote: false,
    cta: "Choose Growth",
    ctaKind: "checkout",
    checkoutUrl: "https://buy.stripe.com/4gM9ASfXrgyy41E8wd0VO01",
    recommended: true,
    recommendedLabel: "Recommended for ongoing marketing execution",
    implementationFee: {
      status: "configured",
      amountCents: 99500,
      label: "$995 one-time",
      waiver: "Waived when you select a six-month Growth agreement.",
    },
    limitsConfigured: true,
    limits: [
      "One location",
      "Up to two campaigns",
      "8–12 social posts per month",
      "2–4 articles per month",
      "Management of up to $5,000/month in client advertising spend",
    ],
    summary: "For businesses that want ongoing marketing execution and clearer results.",
    bestFor:
      "A business already getting inquiries that wants ongoing execution and follow-through.",
    includes: [
      "Everything in AI Visibility",
      "AI-search optimization and content",
      "Social-content creation and management",
      "Landing-page optimization",
      "Conversion tracking and strategy",
      "Advertising management on supported, available channels",
    ],
  },
  {
    id: "growth-360",
    name: "Growth 360",
    priceLabel: "$2,997",
    priceMonthlyCents: 299700,
    priceIsFrom: false,
    customQuote: false,
    cta: "Discuss Growth 360",
    ctaKind: "discuss",
    recommended: false,
    recommendedLabel: null,
    implementationFee: {
      status: "unconfigured",
      amountCents: null,
      label: null,
      waiver: null,
    },
    limitsConfigured: false,
    limits: [],
    summary: "For businesses needing deeper intelligence and coordinated growth work.",
    bestFor: "A multi-campaign business that needs deeper intelligence and attribution.",
    includes: [
      "Everything in Growth",
      "Advanced competitor intelligence",
      "Broader campaign management",
      "Advanced tracking and supported CRM/revenue attribution",
      "Lead-quality reporting",
      "Follow-up recommendations",
      "Reputation and conversion optimization",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "From $4,997",
    priceMonthlyCents: 499700,
    priceIsFrom: true,
    customQuote: true,
    cta: "Contact Sales",
    ctaKind: "contact",
    recommended: false,
    recommendedLabel: null,
    implementationFee: {
      status: "unconfigured",
      amountCents: null,
      label: null,
      waiver: null,
    },
    limitsConfigured: false,
    limits: [],
    summary:
      "For multiple locations, complex integrations and larger requirements — scoped in a custom quote.",
    bestFor: "Multiple locations or complex integration needs, quoted individually.",
    includes: [
      "Multiple locations",
      "Complex integrations",
      "Larger requirements, scoped in a custom quote",
    ],
  },
];

/* ---------------------------------------------- what the AI-search include is */

/**
 * The honest note behind the plan include "AI/search visibility observations
 * through supported sources".
 *
 * The method exists in code: `aiSampleQuestions()` returns five fixed questions
 * and, when it runs, the sample records the question, the date and the answer
 * verbatim. But the sampler is off by default, no runtime caller sets it, and
 * nothing stores or displays the result — so today no run asks an AI assistant
 * anything about a client. The include therefore describes a built method, not a
 * running observation, and every page that prints the include prints this note
 * beside it: the sample is not switched on yet, and a report says plainly that we
 * did not sample rather than showing a zero or a guess. Switching it on is a
 * separate owner decision, not a copy change.
 *
 * One string, used by both plan pages, so the two cannot drift apart.
 */
export const aiSearchObservationNote =
  "The method is built: five fixed questions about your business and businesses like yours in your area, and when a run samples them it records the question, the date and what came back, quoted word for word. It is not switched on yet — no run asks an AI assistant anything today — so a report says plainly that we did not sample, never a zero and never a guess. When it does run it is a sample of what one assistant said on the days we looked: never a ranking, never a position, and not scored.";

/* ------------------------------------------------ where we say our site lives */

/**
 * The one address BravData is published at. Every canonical link, every `og:url`,
 * the `Sitemap:` line in robots.txt and every `<loc>` in sitemap.xml is built
 * from this value.
 *
 * `www` is the canonical form: the bare domain 301-redirects to it (verified
 * 2026-09-22), so nothing may point at `bravdata.io` as a destination.
 *
 * A code-level default, deliberately: the platform proxy terminates TLS and
 * forwards from its own internal name, so the app is never shown the hostname the
 * visitor typed and `SITE_URL` is unset in both environments. Moving the site to a
 * different domain sets `SITE_URL` — see `siteOrigin()` in `src/lib/seo.ts`.
 */
export const CANONICAL_SITE_ORIGIN = "https://www.bravdata.io";

/** The bare domain. A redirect source only — never a destination. */
export const BARE_SITE_ORIGIN = "https://bravdata.io";

/** The platform host the published copy is served from. */
export const PREVIEW_SITE_ORIGIN = "https://06a360909c5f2d91feda6d21b7789195.ctonew.app";

/** The platform host the team's working copy is served from. */
export const DEV_SITE_ORIGIN = "https://06a360909c5f2d91feda6d21b7789195-dev.ctonew.app";

/* ------------------------------------- where a genuine browser post may come from */

/**
 * Origins a genuine browser submission may arrive from.
 *
 * This is a DIFFERENT question from "what do we tell search engines our address
 * is", and it is a separate list on purpose. It is read by the form endpoints'
 * same-origin guard (`src/server/http.ts`) and by the session-token audience list
 * (`src/server/authz/session.ts`). Folding the canonical origin into this list
 * (or this list into the canonical origin) would either reject genuine posts from
 * the owner's own domain or tell search engines the site lives on a platform host.
 *
 * Every origin here is ours: the owner's domain in both forms — a visitor can
 * arrive on the bare domain and post before the redirect completes — and the two
 * platform hosts this build is served from. Each caller adds localhost for local
 * runs. The list still never opens the door to another site's origin: a foreign
 * origin matches none of these hosts and does not claim `sec-fetch-site:
 * same-origin`, so it is still refused.
 */
export const REQUEST_ORIGIN_ALLOWLIST = [
  CANONICAL_SITE_ORIGIN,
  BARE_SITE_ORIGIN,
  PREVIEW_SITE_ORIGIN,
  DEV_SITE_ORIGIN,
];

/**
 * The retirement of the monthly implementation-credit model, stated once.
 *
 * The pricing sweep removed the old `credit` object from every public page, and
 * slice 3 (2026-10-06) removed the object itself once `legal.ts` — its last
 * reader — moved onto the price list. This constant is all that is left of the
 * retired model, and it is what /pricing, / and /start render.
 */
const CREDIT_RETIREMENT_NOTE =
  "The earlier implementation-credit model is retired. Plans now specify concrete deliverables — Growth includes 8–12 social posts and 2–4 articles a month — so you always know exactly what you are getting.";

/**
 * The billing rule, stated once and rendered everywhere a reader meets the money.
 *
 * Owner-directed 2026-10-08: the first month is paid upfront — on Stripe's own
 * secure page, at the moment the subscription starts — and billing is monthly from
 * there; a monthly plan can be cancelled before the next cycle; and a one-time
 * implementation fee is invoiced once at onboarding (or waived on the six-month
 * Growth agreement), never on the subscription page.
 *
 * It replaces three strings that said billing "begins with onboarding", which a
 * reader can take to mean nothing is due until onboarding starts. `full` is the
 * rule; `planCard` is the same rule in the few words a plan card's own one-line
 * footer has room for. Both live here, so /pricing, /start, /how-it-works and the
 * Terms cannot describe the money differently.
 */
const BILLING_UPFRONT = {
  full: "Plans are monthly. The first month is paid upfront on Stripe's secure page when you subscribe — billing is monthly from there, and you can cancel before the next cycle. Where a plan carries an implementation fee it is invoiced once at onboarding, or waived on the six-month Growth agreement, and it is never charged on the subscription page.",
  planCard: "Monthly subscription. The first month is paid upfront.",
};

/** Growth's implementation fee, read from the price list so no clause types the number. */
const GROWTH_FEE = planById("growth")?.implementationFee;
const GROWTH_FEE_AMOUNT_LABEL =
  GROWTH_FEE?.amountCents != null
    ? money(GROWTH_FEE.amountCents)
    : "the fee published with the plan";

export const business = {
  name: "BravData",
  tagline: "Turn Data Into Decisions. Turn Decisions Into Growth.",
  shortDescription:
    "BravData looks at how your business appears to a customer who has never met you, works on what we find with your approval, and reports what can be measured.",
  audience:
    "Independent and small local businesses in and around San Antonio — one to three locations, owned by the person who answers the phone. Medical practices are our featured example, not our boundary: the work is the same whether your customers are patients, diners, clients or callers.",
  contact: {
    // The one public address, and the only place it is written down: the footer,
    // /contact, /client-login, the success and failure panels and the "nothing was
    // saved" fallbacks all render THIS field. Never hard-code an address in a
    // component, and never print one that cannot receive mail — a link nobody can
    // reply to is worse than no link at all.
    //
    // `support@bravdata.io` is the branded mailbox the owner set up (2026-09-24).
    // Note for whoever verifies the live HTML: the owner's domain sits behind
    // Cloudflare's Email Address Obfuscation, which rewrites every `mailto:` into
    // `/cdn-cgi/l/email-protection#<hex>`. The address is still there and still
    // works in a browser; grep the platform-hosted build, or decode the hex
    // (first byte XOR key) to read it back.
    email: "support@bravdata.io",
    // The business phone number (owner-provided 2026-10-07). Display form and
    // the tel: link are kept together so the digits live in exactly one place.
    phone: "(210) 960-5526",
    phoneHref: "tel:+12109605526",
    location: "San Antonio, Texas",
    // The business's physical mailing address (owner-provided 2026-10-15).
    // Three display lines, written once and rendered in the footer and on
    // /contact. Never hard-code this address in a component.
    addressLines: [
      "5835 Callaghan Rd, Suite 204",
      "San Antonio, Texas 78228",
      "United States",
    ],
    replyTarget: "one business day",
    replyHours: "Monday–Friday, 9:00am–5:00pm Central Time",
    replyExclusions: "US holidays excluded",
    aiAvailabilityNotice:
      "AI-assisted tools may answer or draft at any hour, but that is not continuous human support. A person reviews every request on the next business day.",
  },  /**
   * The retired flat setup fee, answered honestly (honesty audit item 13,
   * 2026-10-08).
   *
   * The old single flat setup fee charged to every plan is gone. This note used to
   * open by declaring that flat fee retired, which a reader takes to mean no fee
   * exists at all — while Growth still carries a live fee. So the live fee is stated
   * FIRST, from the price list (`GROWTH_FEE_AMOUNT_LABEL`), the waiver is stated as
   * a waiver (not free), and "retired" is kept to the one fee it really describes:
   * the old flat one. (The phrase the sweep looks for is deliberately absent from
   * this comment: it belongs only in /pricing's FAQ question.)
   */
  setupRetiredNote:
    `There is still a one-time implementation fee on Growth: ${GROWTH_FEE_AMOUNT_LABEL}, waived — not free — on the six-month Growth agreement. The old flat setup fee that every plan used to carry is retired: each plan now states its own implementation fee, AI Visibility publishes none, and a plan whose fee is not yet published has it confirmed in writing before work starts.`,
  /**
   * Copy about the one-time implementation step, for the routes that still
   * describe a single setup stage (the pricing copy sweep replaces those uses with
   * the per-plan `implementationFee`).
   *
   * It states NO amount: the figures live in `PLANS`, so no page can quote a fee
   * that this module does not hold.
   */
  implementation: {
    label: "Implementation fee, confirmed in your agreement",
    plansLine:
      "Each plan states its own implementation fee where one is confirmed; the rest are confirmed in writing before work starts.",
    addition:
      "one-time implementation fee published with the plan you choose — AI Visibility publishes none, and Growth's " +
      `${GROWTH_FEE_AMOUNT_LABEL} fee is waived (not free, and never reduced to nothing) when you select the ` +
      "six-month Growth agreement",
    timingTarget:
      "Implementation is targeted for 10–15 business days after you sign the agreement — and after we have the access listed below. The clock starts on the later of those two, not on the day you first ask a question.",
  },
  acknowledgement: {
    target: "one business day",
    detail:
      "We acknowledge every request within one business day (Monday–Friday, 9:00am–5:00pm Central Time; US holidays excluded).",
  },
  /**
   * RETIRED: the monthly implementation-credit model.
   *
   * Plans no longer sell credits. Each plan lists the deliverables its price
   * includes, and Growth publishes explicit ranges (posts, articles, campaigns,
   * spend) instead of a credit count. No public page renders a credit any more, so
   * this note is what answers a reader who remembers the old model: it is rendered
   * on /pricing, on the home page and on /start, and it promises no credit, no
   * hour, no task and no rollover.
   */
  creditRetirementNote: CREDIT_RETIREMENT_NOTE,
  /**
   * The one secondary call to action every pricing surface offers beside the plan
   * buttons. One string, so no page words the free offer differently.
   */
  secondaryCta: { label: "Get My Free Visibility Check", to: "/visibility-check" },
  /**
   * Third-party advertising budget, stated once.
   *
   * Three separate facts live here and each is rendered from here: what the client
   * pays the platform directly, the one case where BravData's own fee depends on
   * that spend, and the threshold that fee is measured from. The rule is
   * incremental — the fee applies only to the amount ABOVE the threshold, never to
   * the whole budget, and `adManagementIncrementalFee` below is the only place the
   * arithmetic is performed.
   */
  advertising: {
    thresholdMonthlyCents: 500000,
    thresholdLabel: "$5,000",
    incrementalRatePercent: 10,
    incrementalRule:
      "10% of monthly advertising spend ABOVE $5,000 — not of the full budget.",
    separateNote:
      "Advertising budget is separate from BravData's service fee and is paid directly to the advertising platform.",
  },
  /**
   * The social workflow included in Growth, described once so the pricing page and
   * the plan page cannot describe the same process differently. It states what the
   * client does, what the client approves, and the one condition on automatic
   * publishing (explicit client settings — never a missing reply).
   *
   * It also states the one thing that is NOT on today: publishing through a
   * connected account waits on owner-side Meta approval of the posting
   * permission, so the sentence names that and where the workflow stops —
   * appended here so /pricing, /start and /solutions/growth all inherit it from
   * the one string (honesty audit item 14, 2026-10-08).
   */
  growthSocialWorkflow:
    "Client sends photos/videos through supported upload, email or text → AI creates branded drafts → client approves → schedule/publish to authorized connected accounts. Includes content recycling, an editorial calendar, and reminders after three business days without new content. Automatic publishing requires explicit client settings, and publishing to a connected account is not switched on yet: Meta still has to approve BravData's app for posting, so today the workflow runs from your submission through an approved, scheduled draft and stops there — nothing is posted to your account. Included in Growth at no additional subscription charge.",
  /** What the one-time Growth implementation fee buys, in one string. */
  growthImplementationContents:
    "Onboarding, access and data setup, baseline assessment, tracking review, and your initial action plan.",

  plans: PLANS,
  /** What deliberately needs separate scope and is never auto-charged. */
  exclusions: [
    "Additional locations (each extra location is quoted separately)",
    "Advertising spend (you pay platforms directly; we never bill it for you)",
    "Third-party subscriptions (software, listing tools, call tracking)",
    "Website rebuilds or redesigns",
    "Advertising management beyond Growth's included $5,000/month (scoped separately)",
  ],
  exclusionRule:
    "Anything on that list requires a separate written scope and your approval first. Nothing on it is ever auto-charged to your account.",
  /** The things we never claim. */
  neverPromise: [
    "No guaranteed search rankings or positions.",
    "No guaranteed number of new customers or revenue.",
    "No predicted outcomes we cannot measure from your own data.",
  ],
  /** Scope boundaries that protect the client and us. */
  dataBoundaries: [
    "We work with business and marketing data: business contact details, aggregate inquiry and appointment counts, and public listing information.",
    "We do not ask for, store or process personal information about your customers — no customer records, no notes about individual customers or appointments, no customer contact lists.",
    "Metrics that depend on a third party can only be reported where that source actually provides the data. Where it does not, the report says so.",
  ],
  /** The billing rule itself (see `BILLING_UPFRONT` above). */
  billing: BILLING_UPFRONT,
  /** Payment / access prerequisites stated plainly on /pricing. */
  prerequisites: {
    payment: [
      "Where a plan carries an implementation fee, it is invoiced once at onboarding — it is NOT charged on the subscription page. Growth's fee is waived when you select the six-month agreement.",
      BILLING_UPFRONT.full,
      "You keep paying advertising platforms and software vendors directly.",
    ],
    access: [
      "Business profile / listing access (or a manager invitation)",
      "Website access or a way to send changes (CMS login, or a staging environment)",
      "Analytics access where analytics exist",
      "An authorized contact at your business who can approve tasks",
      "Optional, for Growth: aggregate appointment or booking and scheduling reporting where your vendor can export it",
    ],
    noPaymentYet:
      "AI Visibility and Growth can be subscribed to on Stripe's secure page — we link you there and never collect your card details on our own pages. Growth 360 and Enterprise are confirmed in writing first. Nothing on this website is a signature, and the checkout step above is the only purchase path there is.",
  },
  /** The free offer, described the same way everywhere it appears. */
  visibilityCheck: {
    deliverable: [
      "Three evidenced findings across discoverability, clarity and getting in touch.",
      // Supersedes `FREE-CHECK-ALIGNMENT-BRIEF.md` B.2 (which named four blocks
      // and no reason) — this is the method's own order, confidence qualified by
      // the reason for it. Do not "restore" B.2 here.
      "Each finding names what we looked at, what we saw, our confidence and the reason for it, and what it does not show — and carries one next step whenever the evidence supports one.",
      "Delivered in writing — no login, no obligation.",
    ],
    /**
     * The method declined "more than one location wanted" as a decline ground
     * (`FREE-VISIBILITY-CHECK.md`, lines 32–33), and the site said nothing about
     * it — so a multi-location business could read the offer as covering all of
     * its sites. This is the reader's own line, added 2026-09-24. Expect it to be
     * rewritten when the scan replaces the free check; nothing here anticipates
     * that copy.
     */
    locations:
      "One location per free check. If you have more than one, tell us which one to start with and we will say how we would cover the others.",
    target: "Target: three business days after we accept your request.",
    /**
     * WEEKLY, not a concurrent stock. The method, the plan and the report
     * structure all say "at most five OPEN ACCEPTED CHECKS PER WEEK, not a weekly
     * rate"; this string used to say "at most five checks at a time", which is a
     * different promise (owner audit item 7a, 2026-09-24).
     */
    capacity:
      "We accept at most five checks a week — five open accepted checks, not a weekly rate. If five are already open when your request arrives, we tell you the date we will start instead — and that date is the day we accept the check, so it targets three business days after that date.",
    note: "It is free. You do not have to buy anything afterwards, and we will not chase you.",
    scope:
      "We look only at public information about your business and at what your own website does. We do not need your customers' personal information, and please do not send any.",
  },
  cookieNotice:
    "We use one first-party cookie to remember how you found this site (for example a campaign link). No advertising or cross-site tracking cookies.",
  /**
   * Where a price becomes binding — said once, rendered everywhere it is needed,
   * and deliberately the ONLY hedge left on pricing copy. The old footer line
   * ("Pricing shown on this site is our proposed launch default and can change
   * with a written agreement") ran on every route for no reason a reader needed;
   * this replaces it (owner audit items 3 and 8, 2026-09-24).
   */
  terms: {
    writtenAgreement:
      "Prices, scope and anything needing separate quoting are confirmed in the written agreement you sign before any work starts.",
    neverPromiseLine: "We never promise rankings, customer numbers or revenue.",
  },
  /**
   * The state of client accounts, told truthfully (honesty audit item 1,
   * 2026-10-08). The signed-in area is built and running, and self-service signup
   * exists at `/signup`; what varies by environment is whether signup is switched
   * on. The old text here ("is in development… Accounts and logins are not
   * available yet") denied a product that exists, so it is gone.
   *
   * `status` is the internal gate for the "Client login" menu entry, not a claim
   * about whether accounts exist, and it stays as it is: the entry is hidden, the
   * page stays reachable and stays out of search.
   */
  auth: {
    status: "not-open",
    headline: "Client accounts are created at workspace setup",
    detail:
      "The BravData client portal — your weekly priorities, reports and approvals — is built and running. A BravData person creates your account when we set your workspace up with you, and self-service signup opens your own workspace wherever it is switched on. We never ask you to set a password on our own pages: sign-in is handled by our identity provider.",
  },
};

export const primaryPlanCta = { label: "Choose Your Plan", to: "/start" } as const;
export const secondaryPlanCta = { label: "Scan My Business", to: "/scan" } as const;

/** Campaign landing pages we actually run. One page, one campaign. */
export const campaigns = {
  "san-antonio-primary-care": {
    slug: "san-antonio-primary-care",
    name: "San Antonio independent primary care",
    audience:
      "Owners and practice managers of independent primary-care practices in San Antonio, Texas",
    offer: "Free practice visibility check",
    promise:
      "Three evidenced findings across how a business is found, understood and reached, delivered in writing with the evidence behind each one.",
    optionalCall: "An optional review call to walk through the findings.",
    target: "Target: three business days after we accept your request.",
    experiment:
      "This page is one landing-page experiment for San Antonio primary care. It carries the same plan pricing and the same no-guarantee terms as the rest of the site.",
  },
};

export type CampaignSlug = keyof typeof campaigns;

export function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function planById(id: string): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

/**
 * The two-plan sentence the free-check pages render when a reader is already
 * thinking about a plan.
 *
 * Built from the price list, never from a positional array and never with a plan
 * name typed in a component: the drift the audit caught was prose calling the
 * entry plan "Visibility" while the price list calls it "AI Visibility" (honesty
 * audit item 10, marketing audit item 8, 2026-10-08). It also states plainly that
 * the entry plan publishes no implementation fee, and carries Growth's fee and its
 * waiver from Growth's own `implementationFee` — so no page can imply a fee a plan
 * does not have.
 */
export function adjacentPlansLine(): string {
  const entry = planById("ai-visibility");
  const growth = planById("growth");
  if (!entry || !growth) return "";
  const fee = growth.implementationFee;
  const feeSentence =
    fee.status === "configured" && fee.label
      ? `${growth.name} carries a ${fee.label} implementation fee.${fee.waiver ? ` It is ${fee.waiver.charAt(0).toLowerCase()}${fee.waiver.slice(1)}` : ""}`
      : `${growth.name}'s implementation fee is confirmed in writing before work starts.`;
  return `${entry.name} is ${entry.priceLabel}/month and ${growth.name} is ${growth.priceLabel}/month. ${entry.name} has no published implementation fee. ${feeSentence}`;
}

/**
 * BravData's own fee for managing a client's advertising spend, in cents.
 *
 * The published rule is incremental: the first $5,000 of monthly spend carries no
 * management fee, and 10% applies only to the amount above that threshold — not to
 * the whole budget. This is the only place that arithmetic happens; the pricing
 * page renders the rule from `business.advertising` and never recomputes it in
 * prose. A spend at or below the threshold returns 0.
 */
export function adManagementIncrementalFee(monthlySpendCents: number): number {
  const aboveThreshold = Math.max(
    0,
    monthlySpendCents - business.advertising.thresholdMonthlyCents,
  );
  return aboveThreshold * (business.advertising.incrementalRatePercent / 100);
}

/* ------------------------------------------------------- the purchase step */

/**
 * The two Growth terms, and what each one does to the implementation fee.
 *
 * The owner-directed rule (2026-10-06) is that Growth's fee is NOT charged on the
 * subscription page: a Stripe Payment Link carries the monthly subscription only,
 * so the term a client picks decides whether that fee is invoiced once at
 * onboarding or waived. The consequence is therefore written from the plan's own
 * `implementationFee` here — the amount from `label`, the waiver sentence from
 * `waiver` — so this module cannot state a Growth fee the price list does not
 * hold, and the two can never drift apart.
 */
export type GrowthTermId = "month-to-month" | "six-month";

export interface GrowthTermOption {
  id: GrowthTermId;
  /** The choice, as the reader sees it on the button. */
  label: string;
  /** What the client is committing to, in one line. */
  commitment: string;
  /** What the choice does to the implementation fee, in one line. */
  feeConsequence: string;
  /** True for the one choice that waives the fee. */
  feeWaived: boolean;
  /** The price list's own waiver sentence, carried verbatim. Null when none applies. */
  waiverNote: string | null;
}

export function growthTermOptions(): GrowthTermOption[] {
  const fee = planById("growth")?.implementationFee;
  const amount = fee?.label ?? "The implementation fee";
  return [
    {
      id: "month-to-month",
      label: "Month to month",
      commitment: "No minimum term — you can cancel before the next cycle.",
      feeConsequence: `${amount} implementation fee, invoiced at onboarding.`,
      feeWaived: false,
      waiverNote: null,
    },
    {
      id: "six-month",
      label: "Six-month agreement",
      commitment: "A six-month commitment, counted from the day onboarding starts.",
      feeConsequence:
        "Nothing is invoiced for it at onboarding: implementation fee waived (you commit to six months).",
      feeWaived: true,
      waiverNote: fee?.waiver ?? null,
    },
  ];
}

/** Growth's implementation-fee label, read once so the copy below cannot retype it. */
const growthFeeLabel = planById("growth")?.implementationFee.label ?? "The implementation fee";

/**
 * The purchase step: how a client actually subscribes, what Stripe's page does and
 * does not charge, and how cancellation works.
 *
 * Every string here is rendered by the flow; none is retyped in a component. Two
 * facts this module refuses to blur:
 *
 *  - **Payment happens on Stripe's page, not ours.** The links in `PLANS` are
 *    Stripe-hosted Payment Links, so this site never collects card details and
 *    never handles the money. Naming a different processor here, or claiming a
 *    payment on our own page, would be false.
 *  - **The one-time fee is not on that page.** Growth's implementation fee is
 *    invoiced at onboarding or waived by the six-month term — never silently
 *    charged at signup, and never shown as a payment event we did not record.
 *
 * `cancellation` is the whole cancellation policy, and it is the owner's own
 * wording: a monthly plan is cancelled before the next cycle, a six-month
 * agreement commits for six months, and there are no early-termination penalties.
 * The channel is the support address — no cancel button exists yet, and this
 * module will not pretend one does.
 */
export const checkout = {
  /** The processor the subscription is created on. */
  provider: "Stripe",
  /** The final step of the request flow, worded once. */
  link: {
    label: "Subscribe now",
    opensNewTabNote: "Opens Stripe's secure page in a new tab.",
    paymentNotice:
      "Payment happens on Stripe's own secure page, not on this website. We never see or store your card details.",
    afterSubscribing:
      "After you subscribe, a person confirms your agreement and starts your onboarding. The subscription and the written agreement are two separate steps, and nothing is signed here.",
    billing: BILLING_UPFRONT.full,
    cancelBeforeNextCycle: "You can cancel before the next cycle.",
    nothingChargedHere: "Nothing is charged on this page.",
    noSelfServicePlan:
      "There is no self-service subscription for this plan yet. We confirm its scope, limits and fees in writing first, and nothing is charged here.",
    requestRecordedFirst:
      "This records your request first, so we know who you are and what you asked for when the subscription arrives.",
  },
  /**
   * Why the one-time fee is not beside the subscription on Stripe's page, said
   * plainly, because a reader who expects one charge and finds two has been
   * misled by omission.
   */
  implementationFee: {
    notOnSubscriptionPage: `${growthFeeLabel} implementation fee is not charged on the subscription page: a Stripe subscription link carries the monthly plan only. Choose month to month and it is invoiced once at onboarding; choose the six-month agreement and it is waived.`,
    chargedOnce: "Where a plan carries an implementation fee, it is invoiced once, before work starts.",
  },
  /** Cancellation, in full. The channel is the support address. */
  cancellation: {
    summary: "Cancellation is confirmed immediately, with the effective date in writing.",
    monthly:
      "On a monthly plan you cancel before the next cycle, and billing stops at the end of the cycle you are in.",
    sixMonth:
      "A six-month agreement commits you for six months, and the waived implementation fee depends on that term.",
    noPenalties: "There are no early-termination penalties.",
    /**
     * The cancellation channel, as a label. The address is deliberately NOT typed
     * here: it is `business.contact.email`, the one address this site publishes,
     * and the renderer links to that.
     */
    channelLabel: "Email us to cancel",
  },
  /** The two Growth terms the request flow asks about before anyone subscribes. */
  growthTerms: growthTermOptions(),
  termHeading: "Choose your Growth term",
  termIntro:
    "Your choice changes the one-time implementation fee, and the subscription page cannot carry that fee — we invoice or waive it from what you pick here.",
};

