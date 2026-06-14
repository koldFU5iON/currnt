interface Props {
  notes: string | null | undefined
}

export function JobNotesPane({ notes }: Props) {
  return (
    <div className="flex flex-col overflow-hidden">
      {/* Sticky header */}
      <div className="shrink-0 border-b bg-background px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </h2>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {notes?.trim() ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </div>
    </div>
  )
}
