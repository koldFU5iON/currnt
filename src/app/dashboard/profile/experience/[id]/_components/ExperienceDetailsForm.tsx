'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Field, FieldGroup } from '@/components/ui/field'
import { updateExperienceDetails } from '@/modules/profile/actions'
import { Calendar, Loader2, MapPin, Pencil, Save, X } from 'lucide-react'

type Props = {
  experienceId: string
  company: string
  role: string
  location: string | null
  remote: boolean
  startDate: Date
  endDate: Date | null
}

const toDateInput = (d: Date | null) =>
  d ? new Date(d).toISOString().split('T')[0] : ''

function formatDateRange(startDate: Date, endDate: Date | null) {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  return `${fmt(startDate)} – ${endDate ? fmt(endDate) : 'Present'}`
}

export function ExperienceDetailsForm(props: Props) {
  const [editing, setEditing] = useState(false)
  const [company, setCompany] = useState(props.company)
  const [role, setRole] = useState(props.role)
  const [location, setLocation] = useState(props.location ?? '')
  const [remote, setRemote] = useState(props.remote)
  const [startDate, setStartDate] = useState(toDateInput(props.startDate))
  const [endDate, setEndDate] = useState(toDateInput(props.endDate))
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    startTransition(async () => {
      await updateExperienceDetails(props.experienceId, {
        company: company.trim(),
        role: role.trim(),
        location: location.trim() || undefined,
        remote,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
      })
      setEditing(false)
    })
  }

  const handleCancel = () => {
    setCompany(props.company)
    setRole(props.role)
    setLocation(props.location ?? '')
    setRemote(props.remote)
    setStartDate(toDateInput(props.startDate))
    setEndDate(toDateInput(props.endDate))
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">{role}</h1>
          <p className="text-muted-foreground">{company}</p>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              {formatDateRange(props.startDate, props.endDate)}
            </span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin size={13} />
                {location}
                {remote && <span className="text-xs">(Remote)</span>}
              </span>
            )}
            {remote && !location && (
              <span className="text-xs">Remote</span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 shrink-0 cursor-pointer"
          onClick={() => setEditing(true)}
        >
          <Pencil size={13} />
          Edit details
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-4 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Edit details</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
          <X size={14} />
        </Button>
      </div>

      <FieldGroup>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field>
            <Label htmlFor="det-company">Company</Label>
            <Input
              id="det-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              required
            />
          </Field>
          <Field>
            <Label htmlFor="det-role">Role / Title</Label>
            <Input
              id="det-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field>
            <Label htmlFor="det-location">Location</Label>
            <Input
              id="det-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
            />
          </Field>
          <Field>
            <div className="flex items-center gap-2 mt-6">
              <input
                id="det-remote"
                type="checkbox"
                checked={remote}
                onChange={(e) => setRemote(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="det-remote">Remote position</Label>
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field>
            <Label htmlFor="det-start">Start Date</Label>
            <Input
              id="det-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>
          <Field>
            <Label htmlFor="det-end">End Date</Label>
            <Input
              id="det-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={handleCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending || !company.trim() || !role.trim() || !startDate}
          className="gap-1.5"
        >
          {isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
