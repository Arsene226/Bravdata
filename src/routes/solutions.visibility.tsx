import { createFileRoute } from "@tanstack/react-router";
import { SolutionPage, type SolutionContent } from "~/components/SolutionPage";
import { business, planById, aiSearchObservationNote } from "~/config/business";
import { routePageHead } from "~/lib/seo";

export const Route = createFileRoute("/solutions/visibility")({
  head: () => routePageHead("/solutions/visibility"),
  component: VisibilitySolution,
});

/*
 * Everything this page states ABOUT the plan is read from the plan: the displayed
 * name, the price, the summary, `bestFor`, the seven included items, the
 * published limits and the implementation fee all come from
 * `planById("ai-visibility")`. The only strings typed in this file are the
 * sentences that explain an included item — and each of those is keyed by the
 * config's own wording, so if an include is reworded the page shows an
 * unexplained include rather than a sentence that quietly describes something the
 * plan no longer offers.
 *
 * The earlier copy sold this plan as a monthly count of implementation credits.
 * That model is retired (`business.creditRetirementNote`), so no credit count
 * appears here — the plan's own included items carry the page instead.
 */
const plan = planById("ai-visibility")!;
const growthPlan = planById("growth")!;

const INCLUDE_NOTES: Record<string, string> = {
  "Client dashboard":
    "One place to see the observations, the work list and the monthly report — with each finding expandable to what we looked at, where and when.",
  "AI/search visibility observations through supported sources":
    aiSearchObservationNote,
  "Google Business Profile and reputation monitoring where connected":
    "Where your business profile is connected, we monitor the profile fields and what reviews say. That connection is not switched on yet — Google's approval is still pending, so no client can connect one today — and until it is, the report shows that source as not checked, never as a zero.",
  "Competitor monitoring":
    "Who else appears for the searches that matter to you, and what their public pages say that yours do not. Observed from the public web, dated, and never described as anyone's private data.",
  "Prioritized recommendations":
    "Every finding becomes a prioritized action with the evidence behind it. You approve what gets worked on, and you can see what is waiting on us and what is waiting on you.",
  "Limited content support":
    "A limited amount of content work each month — page copy, service descriptions, listing text. Each piece is scoped and approved before it starts.",
  "Monthly reporting":
    "What we looked at, what we found, what changed, what is still open and what we recommend next. Where a number cannot be measured, the report says so instead of estimating it.",
};

/** The plan's own includes, each with the sentence that explains it. */
const delivered = [
  ...plan.includes.map((title) => ({
    title,
    body: INCLUDE_NOTES[title] ?? `Included in ${plan.name}.`,
  })),
  {
    title: "Your own data, kept yours",
    body: "Your listing and website access stay yours. We hand over findings and task evidence, and we do not hold your website hostage if you leave.",
  },
];

const content: SolutionContent = {
  eyebrow: `Plan · ${plan.name}`,
  heroTitle: `${plan.name}: the public information a customer meets before they call — monitored, explained and reported on.`,
  heroIntro: `${plan.summary} You approve the work before it starts, and every finding names what we looked at, where and when.`,
  heroBullets: [
    plan.bestFor,
    `${plan.includes[0]} and ${plan.includes[6].toLowerCase()} — the plan's full scope is listed on this page, not in a footnote.`,
    `${plan.includes[1]}: the five-question method is built and not switched on yet, so a report says we did not sample — never a zero, never a guess.`,
    `${plan.includes[2]}; where a source is not connected it is shown as not checked, never as zero.`,
  ],
  problems: [
    {
      title: "Customers cannot find you for the thing you want to be known for",
      body: "The first thing we test: does the business appear for the service or the product — or only when someone already knows the name? We show you what we saw.",
    },
    {
      title: "What they do find is thin or out of date",
      body: "Hours that disagree between the website and the listing, a missing or wrong phone number, three photos from 2019, and services that are not listed at all.",
    },
    {
      title: "It is not obvious you are right for them",
      body: "A new customer wants to know: do you do this, do you cover my area, and how do I get in? Those three answers belong at the top of the page. If they are not there, the visitor has to go looking.",
    },
    {
      title: "Nobody knows which of these is the real problem",
      body: "Without a baseline you are guessing, even with the best intentions. We write down what we observed, where and when, so next month's change can be judged against it rather than against a feeling.",
    },
  ],
  delivered,
  process: [
    {
      title: "Baseline and access",
      body: "We collect public information about your business, take a baseline snapshot, and ask for listing and website access. Implementation is targeted for 10–15 business days after the agreement is signed and access is in place — whichever of the two comes later.",
    },
    {
      title: "Findings and priorities",
      body: "You get the review with the evidence behind each observation, and we agree what to address first — usually the fix closest to a customer's decision. What is not being worked on is listed as not being worked on.",
    },
    {
      title: "Implementation, with your approval",
      body: "Each task is scoped, approved by your contact, done, and checked. If a task turns out to be bigger than the scope we agreed, we stop and tell you before doing anything else.",
    },
    {
      title: "Report, call, repeat",
      body: "The monthly report and call close the loop — and every third month an extended review of up to 60 minutes runs in place of that month's call. The next cycle starts from what we learned rather than a blank page.",
    },
  ],
  faqs: [
    {
      question: "Is one location really the limit?",
      answer: (
        <>
          <p>
            Yes. {plan.name} covers one location. Additional locations are quoted
            separately and are never charged automatically.
          </p>
        </>
      ),
    },
    {
      question: "What exactly do I get for the monthly price?",
      answer: (
        <>
          <p>
            {plan.priceLabel}/month buys the scope published on this page, in
            full:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {plan.includes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>
            Anything outside it needs a separate written scope and your approval
            first. {business.exclusionRule}
          </p>
        </>
      ),
    },
    {
      question: "What do you mean by sampled AI-search observations?",
      answer: (
        <>
          <p>
            We ask AI-assisted search tools a small set of fixed questions about
            your business and businesses like yours in your area, then record the
            question, the date and what came back. It is a sample of what those
            tools said on the days we looked.
          </p>
          <p>
            It is not a ranking, not a score, and not a promise about what any
            tool will say next month — those tools change often and nobody
            controls them.
          </p>
        </>
      ),
    },
    {
      question: "Do I have to do what you recommend?",
      answer: (
        <>
          <p>
            No. You approve every task before it starts. If you would rather
            address something you spotted yourself, that is usually a good
            decision — you know your customers. What is waiting on your decision
            is listed as waiting on you, and nothing starts without it.
          </p>
        </>
      ),
    },
    {
      question: "Is there a one-time implementation fee?",
      answer: (
        <>
          <p>
            {plan.implementationFee.status === "configured" &&
            plan.implementationFee.label
              ? `Yes: ${plan.implementationFee.label}. ${plan.implementationFee.waiver ?? ""}`
              : `No figure is published for ${plan.name} yet. It is confirmed in writing before any work starts — never applied automatically.`}
          </p>
          <p>{business.terms.writtenAgreement}</p>
        </>
      ),
    },
    {
      question: "What if I want more execution than this?",
      answer: (
        <>
          <p>
            That is what {growthPlan.name} is for: the same monitoring and
            reporting, plus content and social creation each month, conversion
            work and advertising management on supported, available channels.
          </p>
          <p>
            Its published scope is {growthPlan.limits.join(" · ")}. The two plans
            are compared side by side on the pricing page.
          </p>
        </>
      ),
    },
  ],
  otherPlan: {
    title: "Need more hands-on work?",
    body: `${growthPlan.name} covers everything on this page and adds content, social and conversion work each month. Its published scope: ${growthPlan.limits.join(" · ")}. From ${growthPlan.priceLabel}/month.`,
    to: "/solutions/growth",
  },
  otherPlanLabel: `Compare ${growthPlan.name}`,
  /*
   * The page's one photograph: the room a patient walks into. It says "this plan
   * is for a business with a front desk", and it says nothing about results.
   *
   * 2026-10-26: replaced the generic small-business waiting area with a practice
   * waiting room, because the owner asked for imagery of doctor offices and this
   * is the one page where a clinic is the right room. It is AI-GENERATED
   * (placeholder) imagery: empty of people, no text, no signage, no logo, no
   * screen, no certificate and no product in it — nothing in the frame can be
   * read as a patient, a clinician, a review or a result. It is a stand-in for a
   * licensed photograph, not evidence of any client (BravData has none).
   */
  heroPhoto: {
    src: "/photos/practice-waiting-room-800.webp",
    srcSet: "/photos/practice-waiting-room-800.webp 800w, /photos/practice-waiting-room-1280.webp 1280w",
    sizes: "(min-width: 76rem) 76rem, 94vw",
    width: 1280,
    height: 853,
    alt: "An empty medical practice waiting room: four blue upholstered chairs in a row, a light-wood table with a small potted plant, a plain reception counter behind, and daylight from tall windows on the left.",
  },
};

function VisibilitySolution() {
  return <SolutionPage plan={plan} content={content} />;
}
