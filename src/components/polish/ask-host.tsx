import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { registerAskHost, type AskRequest } from "@/lib/polish";

/** Polish preview: shows `ask()` questions as Tsuyu's own dialog. */
export function AskHost() {
  const [req, setReq] = useState<AskRequest | null>(null);

  useEffect(() => {
    registerAskHost((next) => setReq(next));
    return () => registerAskHost(null);
  }, []);

  const answer = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  return (
    <AlertDialog open={!!req} onOpenChange={(open) => { if (!open) answer(false); }}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base leading-snug">{req?.title}</AlertDialogTitle>
          {req?.detail ? (
            <AlertDialogDescription className="whitespace-pre-line">{req.detail}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription className="sr-only">{req?.title}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => answer(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            autoFocus={!req?.destructive}
            onClick={() => answer(true)}
            className={cn(req?.destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {req?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
