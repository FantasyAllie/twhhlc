// Repair notes on a maintenance log item: what needs doing, what's needed,
// what's still outstanding. Shared by the Maintenance Log sheet and the
// maintenance workspace dashboard.
import { useEffect, useState } from "react";
import { NotebookPen, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MAX_NOTES = 2000;

export function MaintenanceNotes({
  requestId,
  notes,
  canEdit = true,
  source = "request",
  iconOnly = false,
}: {
  requestId: string;
  notes?: string | null;
  canEdit?: boolean;
  /** Where the item lives: a maintenance request or a maintenance message. */
  source?: "request" | "message";
  /** Render just the notebook icon, with no text label. */
  iconOnly?: boolean;
}) {
  const table = source === "message" ? "room_messages" : "maintenance_requests";
  const queryKey = source === "message" ? "room_messages" : "maintenance_requests";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setDraft(notes ?? "");
  }, [notes, open]);

  const hasNotes = !!notes && notes.trim().length > 0;

  const save = async () => {
    const value = draft.trim().slice(0, MAX_NOTES);
    setSaving(true);
    const { error } = await supabase
      .from(table as never)
      .update({ notes: value === "" ? null : value, updated_at: new Date().toISOString() } as never)
      .eq("id", requestId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: [queryKey] });
    toast.success("Notes saved.");
    setOpen(false);
  };

  return (
    <div className={iconOnly ? undefined : "mt-2"}>
      {hasNotes && !open && (
        <div className="mb-2 rounded-lg border bg-muted/40 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{notes}</p>
        </div>
      )}
      {!open ? (
        <Button
          type="button"
          size={iconOnly ? "icon" : "sm"}
          variant="outline"
          className={iconOnly ? "h-9 w-9" : "h-8 text-xs"}
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label={hasNotes ? (canEdit ? "Edit notes" : "Notes") : "Notes"}
          title={hasNotes ? (canEdit ? "Edit notes" : "Notes") : "Notes"}
        >
          <NotebookPen className={iconOnly ? "h-4 w-4" : "mr-1 h-3.5 w-3.5"} />
          {!iconOnly && (hasNotes ? (canEdit ? "Edit notes" : "Notes") : "Notes")}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Repair notes
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                setDraft(notes ?? "");
                setOpen(false);
              }}
              aria-label="Close notes"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_NOTES))}
            placeholder="What needs doing, parts needed, what's still outstanding…"
            rows={4}
            maxLength={MAX_NOTES}
            readOnly={!canEdit}
            className="text-sm"
          />
          {canEdit && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                {draft.length}/{MAX_NOTES}
              </span>
              <Button type="button" size="sm" className="h-8 text-xs" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save notes"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
