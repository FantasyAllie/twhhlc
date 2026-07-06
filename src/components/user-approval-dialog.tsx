import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPendingUsers,
  approvePendingUser,
  type PendingUserRow,
  type SubRole,
} from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";

const SUB_ROLE_LABELS: Record<SubRole, string> = {
  reception: "Reception",
  housekeeper: "Housekeeping",
  fnb: "F&B",
  maintenance: "Maintenance",
};

export function UserApprovalDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingUsers);
  const approveFn = useServerFn(approvePendingUser);

  const pendingQ = useQuery({
    queryKey: ["pending_users"],
    enabled: open,
    queryFn: () => listFn() as Promise<PendingUserRow[]>,
  });

  async function onApprove(u: PendingUserRow, subRole: SubRole) {
    try {
      await approveFn({ data: { id: u.id, subRole } });
      toast.success(`Approved as ${SUB_ROLE_LABELS[subRole]}`);
      qc.invalidateQueries({ queryKey: ["pending_users"] });
      qc.invalidateQueries({ queryKey: ["app_users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve user");
    }
  }

  const pending = pendingQ.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-1.5rem)] sm:w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>User Approval</DialogTitle>
          <DialogDescription>
            Approve new signups by assigning them a department. New accounts are regular users by default; only an admin can change their position later.
          </DialogDescription>
        </DialogHeader>
        <section className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b text-sm font-semibold">
            Pending approvals ({pending.length})
          </div>
          {pendingQ.isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No pending accounts.</div>
          ) : (
            <ul className="divide-y">
              {pending.map((u) => (
                <li key={u.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.username}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="default">
                        <Check className="h-4 w-4 mr-1" />
                        Approve as
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Department</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(Object.keys(SUB_ROLE_LABELS) as SubRole[]).map((r) => (
                        <DropdownMenuItem key={r} onClick={() => void onApprove(u, r)}>
                          {SUB_ROLE_LABELS[r]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}