import { z } from 'zod'

export const ManualBoardSchema = z.object({
  category: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  url: z.string().url(),
})

export type ManualBoard = z.infer<typeof ManualBoardSchema>
