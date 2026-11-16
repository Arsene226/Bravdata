/**
 * The REAL pixel size of every article image in `public/blog-images/`.
 *
 * WRITTEN BY `scripts/fetch-blog-image.ts`, never by hand: the script downloads
 * the photograph, reads its width and height out of the file's own bytes, and
 * records them here. Wiping an entry means the size is unknown, and an unknown
 * size is emitted as *no* size — never as a guess.
 *
 * Why a table at all, rather than a number in each article's front matter: the
 * front-matter format is closed (`src/lib/blog-posts.ts`), and a size is not an
 * editorial choice a writer makes — it is a fact about a downloaded file, so it
 * is derived from the file. The blog route passes these values to `pageHead`, so
 * `og:image:width` / `og:image:height` state the card's true dimensions.
 *
 * The gate `verify:blog` re-reads every file named here and fails if the table
 * and the bytes disagree, so this table cannot drift into a claim the file does
 * not support.
 */

export interface BlogImageSize {
  readonly width: number;
  readonly height: number;
}

export const BLOG_IMAGE_SIZES: Readonly<Record<string, BlogImageSize>> = {
  "/blog-images/answering-a-bad-review-without-confirming-a-patient.jpg": { width: 1280, height: 854 },
  "/blog-images/are-paid-ads-worth-it-for-a-practice.jpg": { width: 1280, height: 853 },
  "/blog-images/hipaa-and-marketing-questions-to-settle-before-you-post.jpg": { width: 1280, height: 851 },
  "/blog-images/hours-phone-and-services-first.jpg": { width: 1280, height: 853 },
  "/blog-images/how-the-bravdata-visibility-score-is-built.jpg": { width: 1280, height: 851 },
  "/blog-images/how-to-ask-patients-for-google-reviews.jpg": { width: 1280, height: 802 },
  "/blog-images/how-to-audit-your-public-presence-in-30-minutes.jpg": { width: 1280, height: 851 },
  "/blog-images/how-to-read-your-own-website-like-a-scanner.jpg": { width: 1280, height: 853 },
  "/blog-images/how-to-tell-whether-your-marketing-agency-is-doing-anything.jpg": { width: 1280, height: 853 },
  "/blog-images/local-seo-for-small-business.jpg": { width: 1280, height: 853 },
  "/blog-images/new-website-or-fixes-a-decision-list.jpg": { width: 1280, height: 853 },
  "/blog-images/questions-to-ask-before-you-sign-a-marketing-contract.jpg": { width: 1280, height: 853 },
  "/blog-images/review-follow-up-asking-happy-customers.jpg": { width: 1280, height: 853 },
  "/blog-images/san-antonio-primary-care-public-information-checklist.jpg": { width: 1280, height: 911 },
  "/blog-images/texting-patients-the-questions-to-settle-first.jpg": { width: 1280, height: 853 },
  "/blog-images/website-speed-and-mobile-local-business-checklist.jpg": { width: 1280, height: 851 },
  "/blog-images/what-a-free-visibility-check-is-and-is-not.jpg": { width: 1280, height: 854 },
  "/blog-images/what-a-monthly-practice-marketing-report-should-contain.jpg": { width: 1280, height: 853 },
  "/blog-images/what-ai-search-observations-show-and-cannot.jpg": { width: 1280, height: 853 },
  "/blog-images/what-not-measurable-yet-means.jpg": { width: 1280, height: 837 },
  "/blog-images/what-not-to-do-marketing-your-san-antonio-practice.jpg": { width: 1280, height: 853 },
  "/blog-images/what-practice-marketing-should-cost.jpg": { width: 1280, height: 754 },
  "/blog-images/what-the-free-visibility-check-does.jpg": { width: 1280, height: 607 },
  "/blog-images/where-to-publish-first-site-profile-or-social.jpg": { width: 1280, height: 854 },
  "/blog-images/who-is-managing-your-online-reputation.jpg": { width: 1280, height: 853 },
  "/blog-images/why-customers-find-you-by-name-only.jpg": { width: 1280, height: 853 },
  "/blog-images/your-google-business-profile-the-owners-list.jpg": { width: 1280, height: 666 },
};

/** The recorded size for a site path, or undefined when nothing is recorded. */
export function blogImageSize(path: string | undefined): BlogImageSize | undefined {
  if (!path) return undefined;
  return BLOG_IMAGE_SIZES[path];
}
