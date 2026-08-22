# Initial Technology Baseline

**Status:** Decided

## Decision

Start currnt with a lean, proven application stack and add specialised packages only when a product capability needs them.

## Baseline

- Next.js 16, React 19, and TypeScript.
- PostgreSQL and Prisma.
- Better Auth.
- Tailwind CSS v4, shadcn, and Base UI.
- Zod and React Hook Form.
- AI SDK with optional, user-owned provider keys.
- Tiptap/ProseMirror as the foundation for the shared CV and cover-letter editing workspace.
- React-PDF for document export.
- Vitest and ESLint.

## Principles

- Keep the successful foundations from the previous project.
- Do not copy the old dependency list wholesale.
- Treat the document model as independent from the editor library and PDF renderer.
- Avoid multiple divergent representations of the same document.
- Keep AI optional and user-led.
- Add job extraction, browser capture, PDF import, charts, command palette, drag-and-drop, and email capabilities only when their corresponding product work begins.

## Deferred capabilities

- Browser extension or web clipper.
- URL extraction and browser-based rendering.
- PDF/profile import.
- Command palette.
- Drag-and-drop interactions.
- Email delivery.
- Dashboard analytics and charts.

## Related

- [[02 Shared Capabilities/AI and Prompts|AI and Prompts]]
- [[01 Product Areas/Application Documents|Application Documents]]
- [[00 Foundations/Product Boundary|Product Boundary]]
