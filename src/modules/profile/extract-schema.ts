import * as z from 'zod'

// Lives here (not next to extractFromNotes) because action files use 'use server',
// which forbids non-async exports — schemas have to be reachable from a plain module.
//
// Shared by both the local tag parser and the LLM extraction step. The `source`
// tag on each item lets the UI render a small attribution badge ("parser" vs "llm")
// so the user can tell at a glance which suggestions came from their tagged
// markdown vs the model's read of unstructured prose.

const SourceSchema = z.enum(['parser', 'llm'])
  .describe('Where this suggestion came from. "parser" = a recognized H2 heading bucketed it deterministically. "llm" = extracted from prose that sat under no recognized heading.')

const ActivityKindSchema = z.enum(['responsibility', 'achievement'])
  .describe('"responsibility" = an ongoing duty or scope of work. "achievement" = a specific outcome or measurable result. When ambiguous, prefer responsibility.')

const SkillLevelSchema = z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
  .describe('Self-assessed proficiency. Leave null when the source material gives no clear signal.')

// Constraints are intentionally loose. min/max bounds reject the whole response
// when the model trims or pads slightly, and the cost of a retry is real money.
// The UI is happy with empty arrays; the user just sees a "no suggestions" state.

export const ExtractedActivitySchema = z.object({
  kind: ActivityKindSchema,
  description: z.string().min(1)
    .describe('A single bullet describing the activity. Should stand alone — no leading conjunctions or pronouns referring to other bullets.'),
  impact: z.string().nullable()
    .describe('Optional measurable outcome or numeric result. Null when the source did not specify one — do not fabricate.'),
  source: SourceSchema,
})

export const ExtractedSkillSchema = z.object({
  name: z.string().min(1)
    .describe('The technology, tool, methodology, or domain. Examples: "Kubernetes", "Postgres", "Distributed systems".'),
  category: z.string().nullable()
    .describe('A grouping label for the UI. Examples: "Backend", "DevOps", "Leadership". Null when uncertain — the user assigns one at review time.'),
  level: SkillLevelSchema.nullable(),
  source: SourceSchema,
})

export const ExtractedSuggestionsSchema = z.object({
  overview: z.string().nullable()
    .describe('Free prose under the `## Overview` tag. Context only — not a saveable entity. Null when no overview was provided.'),
  activities: z.array(ExtractedActivitySchema),
  skills: z.array(ExtractedSkillSchema),
})

export type ExtractedActivity = z.infer<typeof ExtractedActivitySchema>
export type ExtractedSkill = z.infer<typeof ExtractedSkillSchema>
export type ExtractedSuggestions = z.infer<typeof ExtractedSuggestionsSchema>
export type SuggestionSource = z.infer<typeof SourceSchema>

// Empty payload used when extract runs on empty notes or when neither tier
// produces anything. Saves callers from null-checking the shape itself.
export const emptyExtractedSuggestions: ExtractedSuggestions = {
  overview: null,
  activities: [],
  skills: [],
}
