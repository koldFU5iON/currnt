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
import { Checkbox } from '@/components/ui/checkbox'
import { LocationTagsInput } from './location-tags-input'
import { addCompany } from '@/modules/job-hunt/actions'
import { AddCompanyInputSchema, type AddCompanyInput } from '@/modules/job-hunt/schema'

export function AddCompanySheet({
  defaultLocations = [],
  defaultRemote = true,
}: {
  defaultLocations?: string[]
  defaultRemote?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const form = useForm<AddCompanyInput>({
    resolver: zodResolver(AddCompanyInputSchema) as never,
    defaultValues: { name: '', website: '', searchLocations: defaultLocations, includeRemote: defaultRemote },
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
              Paste the company website, careers page, or a direct job URL — we&apos;ll detect their ATS and scan for matching roles.
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
                  <FieldLabel>Website or job URL</FieldLabel>
                  <Input placeholder="https://www.mongodb.com or https://job-boards.greenhouse.io/…" {...field} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="searchLocations"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Locations <span className="text-muted-foreground font-normal">(optional)</span></FieldLabel>
                  <LocationTagsInput value={field.value} onChange={field.onChange} />
                  <p className="text-xs text-muted-foreground">Leave empty to see all locations. Press Enter or comma to add each location.</p>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="includeRemote"
              render={({ field }) => (
                <Field>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="includeRemote"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FieldLabel htmlFor="includeRemote" className="cursor-pointer">
                      Include remote listings
                    </FieldLabel>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Includes roles listed as &quot;Remote&quot;, &quot;US-Remote&quot;, etc.</p>
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
