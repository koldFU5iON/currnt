'use client'

import { Separator } from "@/components/ui/separator";
import { H } from "./style/Style";
import clsx from "clsx";

interface ContentContainerProps {
  children: React.ReactNode,
  title: string,
  description?: string,
  fullWidth?: boolean,
}

export function ContentContainer({ children, title, description, fullWidth }: ContentContainerProps) {
  return (

    <div className={clsx("bg-accent rounded-md m-3", !fullWidth && "md:w-6xl max-w-6xl")}>
      <header className="p-4">
        <H size={1}>
          {title}
        </H>
        {description &&
          <div className="text-md text-primary/80 mt-2">
            {description}
          </div>}
      </header>
      <Separator className="mx-3 w-3/4" />
      <main className="p-4">
        {children}
      </main>
    </div>)
}
