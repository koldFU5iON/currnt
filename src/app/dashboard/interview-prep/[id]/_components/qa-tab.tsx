'use client'

type Props = { sessionId: string; activeNoteId: string }

export function QaTab({ activeNoteId }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-xs text-muted-foreground">
        Generate a question bank based on the job, your documents, and interviewer profiles. Questions are organised by interview stage.
      </p>
      <button
        disabled={!activeNoteId}
        className="rounded border border-primary/40 px-4 py-2 text-xs text-primary hover:bg-primary/10 disabled:opacity-40"
      >
        ✦ Generate Q&A bank
      </button>
      <p className="text-[10px] text-muted-foreground">
        Full AI Q&A generation coming in the next phase.
      </p>
    </div>
  )
}
