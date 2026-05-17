import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import clsx from "clsx";
import { ApplicationProgress } from "../types/job-application";


export function AppProgressBar({ progress }: { progress: string }) {
  return (
    <div className="flex-col items-center justify-center">
      <span className="text-xs">progress:</span>
      <div className="flex justify-between items-center w-28">
        {Object.values(ApplicationProgress).map(stage => (
          <>
            {stage === progress ?
              <AppProgressBarNode stage={stage} key={stage} color="green" /> :
              <AppProgressBarNode stage={stage} key={stage} />}
            <AppProgressBarConnector />
          </>))}
      </div>
    </div >
  )
}

type AppProgressBarNodeProps = {
  stage?: string,
  color?: string,
  className?: string,
}

function AppProgressBarNode({ stage, color, className }: AppProgressBarNodeProps) {
  const nodeColor = color ? `bg-${color}-500` : "bg-primary"

  return (
    <HoverCard >
      <HoverCardTrigger className="cursor-pointer">
        <div className={clsx(
          "size-3  hover:border-amber-500 rounded-full border border-primary transition-transform ease-in-out py-1",
          className,
          nodeColor
        )} />
      </HoverCardTrigger>
      <HoverCardContent className="w-fit">
        {stage}
        {/* TODO:add date change */}
        <div className="text-xs font-semibold">
          03-05-2025
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function AppProgressBarConnector({ color, className }: AppProgressBarNodeProps) {
  return <div className={clsx("flex-1 h-0.5 bg-primary last:hidden", className, color)} />
}

type ProgressPopoeverType = {
  label: string
  children: React.ReactNode
}

