/**
 * The one place this site states what ObjectOS is.
 *
 * ## Source of truth
 *
 * `objectstack-ai/objectstack` `README.md` at `main`: lines 7-16 carry the
 * headline and the four promises, lines 26-30 the sentence that defines ObjectOS.
 * The maintainer's ruling of 2026-10-05 (objectos#171, Q4) makes that README the
 * single source of the positioning. This repository and www.objectos.ai both
 * quote it, and neither paraphrases it: when the positioning changes, the README
 * changes first and the new words are copied here, byte for byte.
 *
 * ## Who reads it
 *
 * Three machine-facing surfaces carry `POSITIONING`: the site-wide meta
 * description (`app/layout.tsx`), the `/llms.txt` summary line
 * (`app/llms.txt/route.ts`) and the `description` frontmatter of
 * `content/docs/index.mdx`. MDX frontmatter cannot import, so that third copy is
 * a literal, and `.github/scripts/check-positioning.mjs` compares it to this
 * constant on every pull request — a copy that differs fails CI. The same gate
 * reads the four literals below, so keep each one on the shape it parses: one
 * `export const NAME =` followed by a single quoted string.
 *
 * ## The one departure from the README's bytes
 *
 * `OBJECTOS_DEFINITION` reads "built on ObjectStack" where the README reads
 * "built on this stack". Inside the README the phrase has a referent; on this
 * site it has none, so the referent is spelled out. That is the only
 * substitution, and it is declared here so nobody corrects it back.
 *
 * ## No imports
 *
 * A leaf module on purpose. `app/layout.tsx` imports it and sits on every
 * route's tree, so anything imported here ships in every bundle — `lib/site.ts`
 * measures what one careless import costs at that position. Never add an
 * `import` to this file.
 */

/** README line 7: the headline. */
export const ONTOLOGY_HEADLINE = 'The ontology is the software.';

/** README lines 9-10: the four promises as one sentence. */
export const ONTOLOGY_PROMISE =
  'One executable business ontology. AI writes it, the runtime runs it, agents operate it, you own it.';

/** README lines 27-30: what ObjectOS is, with "this stack" spelled out (see above). */
export const OBJECTOS_DEFINITION =
  "Want the same loop hosted, in the browser, nothing to install? That's ObjectOS, the commercial runtime environment built on ObjectStack.";

/**
 * The edition clause. Not in the README: fixed by the maintainer's rulings on
 * objectos#171 — Q1, ObjectOS still ships a self-managed edition, and Q2, a
 * Cloud tenant can export its ontology and run it on the open runtime — and
 * quoted verbatim by www.objectos.ai as well.
 */
export const OBJECTOS_EDITIONS =
  'ObjectOS runs hosted in the browser with nothing to install (ObjectOS Cloud) or self-managed on your own infrastructure (ObjectOS Enterprise), and on either edition you can export your ontology and run it on the open-source ObjectStack runtime.';

/**
 * The positioning paragraph every machine-facing surface carries, in this order
 * and joined by single spaces. `check-positioning.mjs` composes the same four
 * literals the same way and compares the shipped `/llms.txt` summary against the
 * result, so the composition cannot drift from the parts without a red build.
 */
export const POSITIONING = [
  ONTOLOGY_HEADLINE,
  ONTOLOGY_PROMISE,
  OBJECTOS_DEFINITION,
  OBJECTOS_EDITIONS,
].join(' ');
