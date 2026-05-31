"use server"

import { requireProfile } from "@/lib/session"
import { completeStructured, getLLMConfigStatus } from "@/modules/llm/client"
import { LLMError, type LLMErrorKind } from "@/modules/llm/errors"
import { extractPdfText } from "./pdf"
import { ExtractedProfileSchema, type ExtractedProfile } from "./schema"

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export type ExtractResult =
  | { ok: true; data: ExtractedProfile }
  | { ok: false; error: "no_file" | "not_pdf" | "too_large" | "no_text" | LLMErrorKind; message: string }

const SYSTEM = `You extract a structured career profile from the raw text of a CV/resume PDF.

Rules:
- Extract only what is present. Never invent employers, dates, metrics, or skills.
- LinkedIn-exported CVs group several roles under one company with a tenure total like "5 years 3 months". Emit ONE experience per role, repeat the company on each, and NEVER use that company-level total as a role's dates.
- Dates: experiences use "YYYY-MM"; education uses "YYYY". For a current/"Present" role, omit endDate. Omit any field you cannot fill rather than guessing.
- For each role, put the intro paragraph in "summary" and the bullet points in "activities" (responsibility vs achievement; pull any number/outcome into "impact").
- Use the city/region line for location, never the street address.
- Output only the JSON schema — no prose.`

export async function extractProfileFromPdf(formData: FormData): Promise<ExtractResult> {
  const { profile } = await requireProfile()

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return { ok: false, error: "no_file", message: "Choose a PDF file to import." }
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "not_pdf", message: "That file isn't a PDF. Export your CV as a PDF and try again." }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "too_large", message: "That PDF is over 10 MB. Try a smaller export." }
  }

  const status = await getLLMConfigStatus(profile.id)
  if (!status.configured) {
    return { ok: false, error: "not_configured", message: "Add an LLM API key at /dashboard/settings/llm to import a CV." }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const text = await extractPdfText(bytes)
  if (text.length < 50) {
    return {
      ok: false,
      error: "no_text",
      message: "Couldn't read any text from that PDF — it may be a scanned image. Try a text-based PDF or add your details manually.",
    }
  }

  try {
    const result = await completeStructured(
      profile.id,
      `# CV text\n\n${text}\n\nExtract the structured profile as JSON matching the schema.`,
      ExtractedProfileSchema,
      { system: SYSTEM, temperature: 0.1, maxOutputTokens: 6000 },
    )
    return { ok: true, data: result.object }
  } catch (err) {
    if (err instanceof LLMError) {
      return { ok: false, error: err.kind, message: err.message }
    }
    throw err
  }
}
