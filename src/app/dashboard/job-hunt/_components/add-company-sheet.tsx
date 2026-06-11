'use client'

import { useState, useTransition } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { addCompany } from '@/modules/job-hunt/actions'
import { AddCompanyInputSchema, type AddCompanyInput } from '@/modules/job-hunt/schema'

export function AddCompanySheet() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<AddCompanyInput>({
    resolver: zodResolver(AddCompanyInputSchema) as never,
    defaultValues: { name: '', website: '', searchLocations: [], includeRemote: true },
  })

  function onSubmit(data: AddCompanyInput) {
    startTransition(async () => {
      const result = await addCompany(data)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Watching ${data.name}`)
      setOpen(false)
      form.reset()
      router.refresh()
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4 mr-1.5" />
        Add Company
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Watch a Company</SheetTitle>
            <SheetDescription>
              We&apos;ll detect their ATS provider and scan for roles that match your profile.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-6">
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Company name</FieldLabel>
                  <Input placeholder="MongoDB" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="website"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Website</FieldLabel>
                  <Input placeholder="https://www.mongodb.com" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </form>

          <SheetFooter className="px-4">
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {isPending ? 'Detecting ATS…' : 'Watch Company'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
