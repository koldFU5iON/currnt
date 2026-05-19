'use client'

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import clsx from "clsx";
import React from "react";
import { ApplicationProgress, ApplicationProgressType } from "@/app/types/job-application";

const stages = Object.values(ApplicationProgress)

type NodeState = "past" | "active" | "future"

export function AppProgressBar({ progress }: { progress: ApplicationProgressType }) {
  const activeIndex = stages.indexOf(progress)

  return (
    <div className="flex flex-col items-center justify-center">
      <span className="text-xs text-muted-foreground">progress:</span>
      <div className="flex items-center w-28">
        {stages.map((stage, index) => {
          const state: NodeState = index < activeIndex ? "past" : index === activeIndex ? "active" : "future"
          return (
            <React.Fragment key={stage}>
              <AppProgressBarNode stage={stage} state={state} />
              {index < stages.length - 1 && (
                <AppProgressBarConnector filled={index < activeIndex} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

type AppProgressBarNodeProps = {
  stage: string
  state: NodeState
}

function AppProgressBarNode({ stage, state }: AppProgressBarNodeProps) {
  return (
    <HoverCard>
      <HoverCardTrigger className="cursor-pointer">
        <div className="relative flex items-center justify-center size-3">
          {state === "active" && (
            <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-40" />
          )}
          <div className={clsx(
            "size-3 rounded-full border transition-colors duration-300",
            {
              "bg-primary border-primary": state === "past",
              "bg-green-500 border-green-500": state === "active",
              "bg-background border-border": state === "future",
            }
          )} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-fit text-sm capitalize">
        {stage}
      </HoverCardContent>
    </HoverCard>
  )
}

function AppProgressBarConnector({ filled }: { filled: boolean }) {
  return (
    <div className={clsx(
      "flex-1 h-0.5 transition-colors duration-300",
      filled ? "bg-primary" : "bg-border"
    )} />
  )
}
