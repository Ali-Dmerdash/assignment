import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { JobInput } from "@/lib/queries"

export interface JobFormValues {
  title: string
  company: string
  description: string
  location: string
  salary: string
  status: "draft" | "published"
}

const EMPTY: JobFormValues = {
  title: "",
  company: "",
  description: "",
  location: "",
  salary: "",
  status: "draft",
}

interface JobFormProps {
  initial?: Partial<JobFormValues>
  submitLabel: string
  pending?: boolean
  onSubmit: (values: JobInput) => void
  onCancel: () => void
}

export function JobForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: JobFormProps) {
  const [values, setValues] = useState<JobFormValues>({ ...EMPTY, ...initial })

  const set =
    <K extends keyof JobFormValues>(key: K) =>
    (v: JobFormValues[K]) =>
      setValues((prev) => ({ ...prev, [key]: v }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    // Trim, and omit optional fields when blank so we don't store empty strings.
    onSubmit({
      title: values.title.trim(),
      company: values.company.trim(),
      description: values.description.trim(),
      location: values.location.trim() || undefined,
      salary: values.salary.trim() || undefined,
      status: values.status,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            required
            value={values.title}
            onChange={(e) => set("title")(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            required
            value={values.company}
            onChange={(e) => set("company")(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          required
          rows={8}
          value={values.description}
          onChange={(e) => set("description")(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location (optional)</Label>
          <Input
            id="location"
            placeholder="e.g. Montreal or Remote"
            value={values.location}
            onChange={(e) => set("location")(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="salary">Salary (optional)</Label>
          <Input
            id="salary"
            placeholder="e.g. $90k–$120k"
            value={values.salary}
            onChange={(e) => set("salary")(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Status</Label>
        <Select
          value={values.status}
          onValueChange={(v) => set("status")(v as JobFormValues["status"])}
        >
          <SelectTrigger className="w-full sm:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft — hidden from applicants</SelectItem>
            <SelectItem value="published">
              Published — visible &amp; open to apply
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-2 flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
