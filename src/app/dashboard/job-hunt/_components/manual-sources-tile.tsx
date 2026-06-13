import { ExternalLink } from 'lucide-react'

const MANUAL_SOURCES = [
  {
    vertical: 'Gaming',
    boards: [
      { label: 'Hitmarker', url: 'https://hitmarker.net/jobs' },
      { label: 'GamesJobsDirect', url: 'https://www.gamesjobsdirect.com' },
      { label: 'Work With Indies', url: 'https://www.workwithindies.com' },
    ],
  },
  {
    vertical: 'Comms / PR',
    boards: [
      { label: 'PR Week Jobs', url: 'https://jobs.prweek.com' },
      { label: 'Marketing Week', url: 'https://jobs.marketingweek.com' },
      { label: 'The Drum Jobs', url: 'https://www.thedrum.com/jobs' },
    ],
  },
  {
    vertical: 'Ireland',
    boards: [
      { label: 'IrishJobs.ie', url: 'https://www.irishjobs.ie' },
      { label: 'Jobs.ie', url: 'https://www.jobs.ie' },
      { label: 'PublicJobs.ie', url: 'https://www.publicjobs.ie' },
    ],
  },
  {
    vertical: 'Executive',
    boards: [
      { label: 'Exec Appointments', url: 'https://www.exec-appointments.com' },
      { label: 'Odgers Berndtson', url: 'https://www.odgersberndtson.com/en/careers' },
    ],
  },
]

export function ManualSourcesTile() {
  return (
    <div className="rounded-lg border border-dashed px-3 py-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Manual — use bookmarklet
      </p>
      {MANUAL_SOURCES.map((group) => (
        <div key={group.vertical}>
          <p className="text-[10px] font-medium text-muted-foreground mb-1">{group.vertical}</p>
          <div className="space-y-0.5">
            {group.boards.map((board) => (
              <a
                key={board.label}
                href={board.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-foreground hover:text-primary transition-colors"
              >
                {board.label}
                <ExternalLink className="size-2.5 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
