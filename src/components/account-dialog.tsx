// Account settings dialog: username, email, password and linked providers.
// Extracted verbatim from src/routes/app.tsx (stage 5).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getStoredUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export EOF
sed -n '1,276p' /tmp/acct.txt >> src/components/account-dialog.tsx
tail -5 src/components/account-dialog.tsx
