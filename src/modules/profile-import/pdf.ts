import { extractText, getDocumentProxy } from "unpdf"

// The one place we touch a PDF parser. Returns merged plain text across all
// pages; an image-only/scanned PDF yields little-to-no text, which the caller
// treats as the `no_text` case (no OCR in v1).
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: true })
  return text.trim()
}
