# Product

## Register

product

## Users

**Primary:** Devon, a senior program manager with 15+ years of complex career history who needs a smarter tool than a spreadsheet or a generic CV builder.

**Eventual:** Job seekers broadly, particularly experienced professionals whose careers don't fit neatly into a template. People who find the gap between "everything I've done" and "what this specific employer needs to see" too wide to close manually.

**Context when using it:** Preparing for a specific application, reviewing their profile before a batch send, or reviewing AI-generated output before sending. Focused work, moderate stakes. Not casual browsing.

## Product Purpose

currnt is a career intelligence system: a structured, living record of your entire professional self, and the intelligence layer that turns it into the right story for each role. You dump your raw experience, skills, and education without filter (the full, unedited version of who you are professionally), and currnt keeps it structured and current. On top of that record it reasons about fit and assembles a tailored CV for each opportunity you target. AI does the heavy lifting but never takes the wheel: every output is transparent, inspectable, and editable before it leaves your hands.

The core gap it closes: the distance between "everything I've done" and "what this employer needs to see," bridged intelligently rather than by hand. Over time currnt becomes the source of truth your career is run from, not a document you rebuild per application.

Success looks like a user whose career record stays current and who sends better, sharper applications faster, confident the output actually reflects them.

## Brand Personality

Calm, intelligent, precise.

The app should feel like a great editor who also happens to know your entire career by heart. The app earns trust through clarity and control, not through excitement or visual drama. Never breathless about AI.

## Anti-references

- **Canva Resume Builder / Zety**: decoration-first, template-picker UX, output that looks designed but isn't tailored. We're the opposite.
- **Generic ATS trackers** (Workable, Greenhouse from the candidate side): corporate, dense, zero personality. Functional but joyless.
- **AI writing tools that hide their work** (Jasper, Copy.ai): you get output, no transparency, no control. currnt shows the seams on purpose.
- **Loud productivity SaaS** (hero metrics, gradient text, icon-grid dashboards): visual excitement masking weak functionality.

> Working name: **currnt** (lowercase). The product identity lives in `src/lib/brand.ts` and the visual system in `DESIGN.md`.

## Design Principles

1. **The data is the product.** Career content is the substance; UI is the surface it lives on. Don't let chrome compete with content.
2. **Control is always visible.** Every AI action is inspectable and reversible. The user should never wonder what happened or feel locked out.
3. **Calm is a feature.** Job searching is stressful. The tool should feel like a relief: quiet authority, not anxious productivity-app energy.
4. **Precision over decoration.** White space, type weight, and layout carry the visual weight. Ornament only where it earns its place.
5. **Editorial, not administrative.** Notion and Craft got something right: a document-first feel makes writing feel natural. This is a workspace, not a form.

## Accessibility & Inclusion

WCAG AA as a baseline. Keyboard navigation throughout (the primary user is a power user). No motion assumptions. Color never the sole signal. Standard considerations: no specific accommodation requirements defined yet, revisit before public launch.
