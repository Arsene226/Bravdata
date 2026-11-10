import { createFileRoute } from "@tanstack/react-router";
import { SolutionPage, type SolutionContent } from "~/components/SolutionPage";
import { business, planById } from "~/config/business";
import { Callout, Card, Section, SectionHeading } from "~/components/ui";
import { routePageHead } from "~/lib/seo";

export const Route = createFileRoute("/solutions/growth")({
  head: () => routePageHead("/solutions/growth"),
  component: GrowthSolution,
});

/*
 * As on the AI Visibility page, everything this page states about the plan is
 * read from the plan: the name, the price, the summary, `bestFor`, the six
 * included items, the five published limits and the implementation fee come from
 * `planById("growth")`. The advertising ceiling and the incremental rule come from
 * `business.advertising`, and the social workflow from
 * `business.growthSocialWorkflow` — so the page cannot describe the same process
 * differently from `/pricing`.
 *
 * The earlier copy sold this plan as a monthly count of implementation credits
 * (four in total, as it then had to explain). That model is retired
 * (`business.creditRetirementNote`), so no credit count appears here; the plan's
 * own deliverable ranges (posts, articles, campaigns, spend) are what the page
 * publishes instead.
 */
const plan = planById("growth")!;
const aiVisibility = planById("ai-visibility")!;

const INCLUDE_NOTES: Record<string, string> = {
  "Everything in AI Visibility": `${aiVisibility.summary} The monitoring, the AI-search observation method, the reputation monitoring where an account is connected, and the monthly report all carry over unchanged. That method is not switched on yet — no run samples an AI assistant today — so a Growth report says we did not sample, never a zero and never a guess.`,
  "AI-search optimization and content":
    "Improving the pages and profiles the scan points at — copy that answers the question a customer actually has, written in your voice and approved by you before anything is published.",
  "Social-content creation and management":
    "Branded drafts made from the photos and videos you already take, with you approving each one before it is scheduled or published. The full workflow — including automatic publishing — is set out below.",
  "Landing-page optimization":
    "The page a campaign or a search actually points at: is the offer clear, is the next step obvious, and does the whole thing work on a phone.",
  "Conversion tracking and strategy":
    "Where inquiries come from and what happened to them, measured from your own records — including the parts that cannot be measured yet, which the report names instead of estimating.",
  "Advertising management on supported, available channels": `Management of your campaigns on the channels we support: up to ${business.advertising.thresholdLabel}/month of your advertising spend is included. ${business.advertising.separateNote} ${business.advertising.incrementalRule}`,
};

/**
 * The plan's own includes, each with the sentence that explains it, then the two
 * process facts a reader asks about next: the social workflow in full, and what
 * the one-time implementation fee covers.
 */
const delivered = [
  ...plan.includes.map((title) => ({
    title,
    body: INCLUDE_NOTES[title] ?? `Included in ${plan.name}.`,
  })),
  {
    title: "The social workflow, in full",
    body: business.growthSocialWorkflow,
  },
  {
    title: "What the one-time implementation covers",
    body: business.growthImplementationContents,
  },
];

const content: SolutionContent = {
  eyebrow: `Plan · ${plan.name}`,
  heroTitle: `${plan.name}: ongoing execution each month, and an honest answer to whether it moved anything.`,
  heroIntro: `${plan.summary} You approve the work before it starts, and anything outside the published scope is quoted in writing first — never charged automatically.`,
  heroBullets: [
    `Everything in ${aiVisibility.name} carries over — the monitoring, the observation method and the monthly report.`,
    `Social-content creation and management, included at no additional subscription charge, with you approving each draft.`,
    `Published monthly scope: ${plan.limits.join(" · ")}.`,
    `Advertising management on supported, available channels, including up to ${business.advertising.thresholdLabel}/month of your advertising spend.`,
  ],
  problems: [
    {
      title: "You are paying for attention you cannot account for",
      body: "If you cannot say which part of last month's marketing produced last month's inquiries, that is a missing record, not a mystery. It can be built from what your front desk already hears.",
    },
    {
      title: "Inquiries arrive with no source attached",
      body: "Two platforms will each claim the same caller. Without asking the customer, the totals do not add up — which is why the first fix is usually one question at the front desk or on the phone, not a new tool.",
    },
    {
      title: "Nobody follows inquiries through to what happened next",
      body: "Whether those people got appointments, and how many never did, is the part that is easy to leave unmeasured — which is what conversion tracking is for. Where your systems cannot tell us, the report says so.",
    },
    {
      title: "There is no dataset to argue with",
      body: "When a vendor says a campaign is working, the business has nothing to check it against. Six honest months of a few numbers gives you something to check it against.",
    },
  ],
  delivered,
  process: [
    {
      title: "Baseline, access and data mapping",
      body: `Alongside the ${aiVisibility.name} baseline we map what you can actually produce — inquiry records, call logs and whatever your booking or scheduling system can export — and agree what is measurable before promising anything.`,
    },
    {
      title: "Findings, with the gaps named",
      body: "You get the visibility findings plus a short list of what cannot be measured yet and what would need to change for it to be. Gaps are reported, not papered over.",
    },
    {
      title: "Work you approve, one item at a time",
      body: `Every task is scoped and approved by your contact before it starts; then we deliver it and you get the evidence. Anything beyond the published scope — ${plan.limits.join(" · ")} — waits for the next cycle or a separate scope you agree in writing.`,
    },
    {
      title: "Monthly report, call, quarterly review",
      body: `The monthly cycle runs as in ${aiVisibility.name}, with the added content, social and conversion work. Every third month we step back and revisit whether the measurement itself is still telling the truth.`,
    },
  ],
  faqs: [
    {
      question: `Is ${plan.name} really everything in ${aiVisibility.name}?`,
      answer: (
        <>
          <p>
            Yes. {plan.includes[0]}, plus the extra scope published on this page:
            content, social, landing pages, conversion tracking and advertising
            management. The two plans are compared side by side on the pricing
            page.
          </p>
          <p>
            The monthly scope on this plan is {plan.limits.join(" · ")}. Anything
            outside it needs a separate written scope and your approval first.
          </p>
        </>
      ),
    },
    {
      question: "What does “where the data exists” mean?",
      answer: (
        <>
          <p>
            It means we only report a measurement when your own systems can
            actually produce it. Whether the system you book or schedule with
            can export aggregate counts is something we
            check during implementation, and we tell you plainly either way.
          </p>
          <p>
            We will not estimate those numbers, and we never quote a conversion
            rate you cannot verify.
          </p>
        </>
      ),
    },
    {
      question: "Do you need customer-level data?",
      answer: (
        <>
          <p>
            No. Aggregate counts only — by date and source, not customer-level
            records.
          </p>
          <p>{business.dataBoundaries[1]}</p>
        </>
      ),
    },
    {
      question: "Can you run our advertising too?",
      answer: (
        <>
          <p>
            On supported, available channels, yes: management of up to{" "}
            {business.advertising.thresholdLabel}/month of your advertising spend
            is included in {plan.name}. Above that, the work needs an accepted
            upgrade or a separate scope — the published rule is{" "}
            {business.advertising.incrementalRule}
          </p>
          <p>
            The work happens inside your own advertising accounts, with you
            holding the account and the access. BravData holds no advertising or
            analytics integration of its own and installs no tracking code on
            your site, so what we can manage and measure is what those platforms
            show you.
          </p>
          <p>
            {business.advertising.separateNote} We never bill advertising spend
            for you and never charge it automatically.
          </p>
        </>
      ),
    },
    {
      question: "Am I buying hours, or deliverables?",
      answer: (
        <>
          <p>{business.creditRetirementNote}</p>
          <p>
            Time is not the measure, and neither is a count of tasks: what the
            plan delivers each month is published above, and work outside it is
            quoted in writing before it starts.
          </p>
        </>
      ),
    },
    {
      question: "How is this different from a marketing agency retainer?",
      answer: (
        <>
          <p>
            We are measured on work you approved, findings with evidence, and
            measurement you can audit. We do not promise rankings or customer
            numbers, and we hand your data back on request.
          </p>
        </>
      ),
    },
  ],
  extra: (
    <Section>
      <SectionHeading
        eyebrow="Honest limits"
        title={`What ${plan.name} cannot do without your data`}
        intro={`${plan.name} includes conversion tracking and advertising management on supported channels. Here is what we need from your side for that work to mean anything — and what we will say when it is missing.`}
      />
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="text-lg">We can analyse it when…</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>You log inquiries with a source, even in a spreadsheet.</li>
            <li>
              Your systems export aggregate appointment counts by date and source.
            </li>
            <li>
              Campaign links use consistent parameters so submissions carry their
              source.
            </li>
          </ul>
        </Card>
        <Card>
          <h3 className="text-lg">We will say “not measurable yet” when…</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Two systems disagree and neither can be verified.</li>
            <li>
              Inquiries and appointments cannot be joined even at aggregate level.
            </li>
            <li>
              A platform reports leads that nobody on your team ever saw.
            </li>
          </ul>
        </Card>
      </div>
      <div className="mt-6">
        <Callout tone="warn" title="What we will never claim">
          <ul className="list-disc space-y-1 pl-5">
            {business.neverPromise.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>
              No conversion or cost-per-customer figure we cannot trace back to
              your records.
            </li>
          </ul>
        </Callout>
      </div>
    </Section>
  ),
  otherPlan: {
    title: "Need less to start with?",
    body: `${aiVisibility.name} is the first step: ${aiVisibility.bestFor} It is ${aiVisibility.priceLabel}/month, and its full scope is listed on its own page.`,
    to: "/solutions/visibility",
  },
  otherPlanLabel: `Compare ${aiVisibility.name}`,
  /*
   * The page's one photograph (2026-10-06): the counter where the photos this
   * plan works on actually get taken — a phone left face-down, a pad and a
   * coffee. No people, no screen contents, no text, and no product interface
   * presented as if it were live.
   */
  heroPhoto: {
    src: "/photos/counter-phone-1100.webp",
    sizes: "(min-width: 76rem) 76rem, 94vw",
    width: 1100,
    height: 733,
    alt: "A phone lying face-down on a wooden shop counter beside an open notebook and a cup of coffee, in daylight.",
  },
};

function GrowthSolution() {
  return <SolutionPage plan={plan} content={content} />;
}
