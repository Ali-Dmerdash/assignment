import { useRef, useState, type FormEvent } from "react"
import { useMutation } from "@tanstack/react-query"
import { useStore } from "@tanstack/react-store"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { applyToJob } from "@/lib/queries"
import { authStore } from "@/store/auth"
import type { ApiError } from "@/lib/api"

const ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"

interface ApplyDialogProps {
  jobId: string
  jobTitle: string
  /** Called when the application is accepted, or a 409 reveals a prior apply. */
  onApplied: () => void
}

export function ApplyDialog({ jobId, jobTitle, onApplied }: ApplyDialogProps) {
  const { user } = useStore(authStore, (s) => s)
  const [open, setOpen] = useState(false)
  const [coverNote, setCoverNote] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const form = new FormData()
      const file = fileRef.current?.files?.[0]
      if (file) form.append("cv", file)
      if (coverNote.trim()) form.append("coverNote", coverNote.trim())
      // Name/email are intentionally omitted — the server fills them from the
      // authenticated profile (never trust the client for identity).
      return applyToJob(jobId, form)
    },
    onSuccess: () => {
      toast.success("Application submitted", {
        description: `You applied to "${jobTitle}".`,
      })
      setOpen(false)
      onApplied()
    },
    onError: (err: ApiError) => {
      if (err.status === 409) {
        // Already applied — reflect that in the parent and close.
        toast.info("You have already applied to this job.")
        setOpen(false)
        onApplied()
        return
      }
      toast.error(err.message || "Could not submit application")
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!fileRef.current?.files?.[0]) {
      toast.error("Please attach your CV (PDF, DOC, or DOCX).")
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>Apply now</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to {jobTitle}</DialogTitle>
          <DialogDescription>
            Your name and email are taken from your profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={user?.name ?? ""} readOnly disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} readOnly disabled />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="coverNote">Cover note (optional)</Label>
            <Textarea
              id="coverNote"
              rows={4}
              placeholder="A short note to the employer…"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cv">CV (PDF, DOC, or DOCX)</Label>
            <Input id="cv" type="file" accept={ACCEPT} ref={fileRef} required />
            <p className="text-muted-foreground text-xs">
              Max 5&nbsp;MB. The file type is verified on the server.
            </p>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting…" : "Submit application"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
