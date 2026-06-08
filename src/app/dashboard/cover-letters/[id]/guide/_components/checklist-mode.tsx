import { CHECKLIST } from '@/modules/writing-guide/checklist'

type Props = { onBack: () => void }

export function ChecklistMode({ onBack }: Props) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <button
        onClick={onBack}
        className="mb-6 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </button>

      <h2 className="text-lg font-semibold">Writing checklist</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Work through each section before you start or as you write.
      </p>

      <div className="mt-6 space-y-6">
        {CHECKLIST.map((section) => (
          <div key={section.heading}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {section.heading}
            </h3>
            <ul className="mt-2 space-y-2">
              {section.prompts.map((prompt) => (
                <li key={prompt} className="flex gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
                  <span>{prompt}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
