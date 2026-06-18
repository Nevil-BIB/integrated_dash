'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteExtractionButtonProps {
  extractionId: string
  filename: string
  /** Render as a dropdown menu item instead of a button */
  asMenuItem?: boolean
}

export function DeleteExtractionButton({
  extractionId,
  filename,
  asMenuItem = false,
}: DeleteExtractionButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/extractions/${extractionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast.success('Extraction deleted')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Failed to delete extraction')
    } finally {
      setIsDeleting(false)
    }
  }

  const trigger = asMenuItem ? (
    <DropdownMenuItem
      variant="destructive"
      onSelect={(e) => {
        e.preventDefault()
        setOpen(true)
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className="text-destructive hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Extraction</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{filename}&quot;? This will
            permanently delete the document and all extracted data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
