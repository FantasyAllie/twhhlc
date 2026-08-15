/**
 * Lazily-loaded panels (sheets & dialogs).
 *
 * These components are only mounted once they have been opened for the first
 * time, which keeps their code out of the initial bundle and off the first
 * render path. After the first open they stay mounted so Radix open/close
 * animations still work exactly as before.
 */
import React, { Suspense, useEffect, useState } from "react";

type AnyComponent<P> = React.ComponentType<P>;

function makeLazyPanel<P extends object>(
  load: () => Promise<AnyComponent<P>>,
  isOpen: (props: P) => boolean,
): React.ComponentType<P> {
  const Lazy = React.lazy(async () => ({ default: await load() }));
  return function LazyPanel(props: P) {
    const open = isOpen(props);
    const [mounted, setMounted] = useState(open);
    useEffect(() => {
      if (open) setMounted(true);
    }, [open]);
    if (!mounted) return null;
    return (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}

const openProp = (p: { open?: boolean }) => Boolean(p.open);

/* ---- print / export ---- */

export const RoomStatusPrintDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/exports/print-picker-dialogs")["RoomStatusPrintDialog"]>
>(() => import("@/components/exports/print-picker-dialogs").then((m) => m.RoomStatusPrintDialog), openProp);

export const LinenCountPrintDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/exports/print-picker-dialogs")["LinenCountPrintDialog"]>
>(() => import("@/components/exports/print-picker-dialogs").then((m) => m.LinenCountPrintDialog), openProp);

export const SnapshotPrintDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/exports/print-picker-dialogs")["SnapshotPrintDialog"]>
>(() => import("@/components/exports/print-picker-dialogs").then((m) => m.SnapshotPrintDialog), openProp);

export const MaintenancePrintDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/exports/print-picker-dialogs")["MaintenancePrintDialog"]>
>(() => import("@/components/exports/print-picker-dialogs").then((m) => m.MaintenancePrintDialog), openProp);

export const ExportPreviewDialogs = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/exports/export-preview-dialogs")["ExportPreviewDialogs"]>
>(
  () => import("@/components/exports/export-preview-dialogs").then((m) => m.ExportPreviewDialogs),
  (p) => Boolean(p.exportOpen || p.roomStatusExportOpen || p.rejectExportOpen || p.confirmOverwrite),
);

export const SnapshotViewerDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/exports/snapshot-viewer-dialog")["SnapshotViewerDialog"]>
>(
  () => import("@/components/exports/snapshot-viewer-dialog").then((m) => m.SnapshotViewerDialog),
  (p) => p.viewingSnapshot != null,
);

export const HistorySheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/exports/history-sheet")["HistorySheet"]>
>(() => import("@/components/exports/history-sheet").then((m) => m.HistorySheet), openProp);

/* ---- linen ---- */

export const LinenListDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/linen/linen-list-dialog")["LinenListDialog"]>
>(() => import("@/components/linen/linen-list-dialog").then((m) => m.LinenListDialog), (p) => Boolean(p.templateOpen));

export const RejectsDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/linen/counter-dialogs")["RejectsDialog"]>
>(() => import("@/components/linen/counter-dialogs").then((m) => m.RejectsDialog), openProp);

export const DeliveryDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/linen/counter-dialogs")["DeliveryDialog"]>
>(() => import("@/components/linen/counter-dialogs").then((m) => m.DeliveryDialog), openProp);

/* ---- rooms ---- */

export const RoomNotesSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/notes-sheet")["RoomNotesSheet"]>
>(() => import("@/components/rooms/notes-sheet").then((m) => m.RoomNotesSheet), (p) => p.notesSheetRoom != null);

export const ReceptionStatusSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/reception-status-sheet")["ReceptionStatusSheet"]>
>(
  () => import("@/components/rooms/reception-status-sheet").then((m) => m.ReceptionStatusSheet),
  (p) => p.receptionSheetRoom != null,
);

export const EditRoomDefaultsSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/edit-room-sheets")["EditRoomDefaultsSheet"]>
>(
  () => import("@/components/rooms/edit-room-sheets").then((m) => m.EditRoomDefaultsSheet),
  (p) => p.editDefaultsSheetRoom != null,
);

export const EditRoomSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/edit-room-sheets")["EditRoomSheet"]>
>(() => import("@/components/rooms/edit-room-sheets").then((m) => m.EditRoomSheet), (p) => p.editRoomSheetNumber != null);

export const RoomTypesSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/config-sheets")["RoomTypesSheet"]>
>(() => import("@/components/rooms/config-sheets").then((m) => m.RoomTypesSheet), openProp);

export const RoomFeaturesSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/config-sheets")["RoomFeaturesSheet"]>
>(() => import("@/components/rooms/config-sheets").then((m) => m.RoomFeaturesSheet), openProp);

export const ReceptionItemsSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/config-sheets")["ReceptionItemsSheet"]>
>(() => import("@/components/rooms/config-sheets").then((m) => m.ReceptionItemsSheet), openProp);

export const AddConfigDialogs = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/add-config-dialogs")["AddConfigDialogs"]>
>(
  () => import("@/components/rooms/add-config-dialogs").then((m) => m.AddConfigDialogs),
  (p) => Boolean(p.addRoomTypeOpen || p.addRoomFeatureOpen || p.addReceptionItemKind || p.receptionHelpOpen),
);

export const ManageRoomsDialogs = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/rooms/manage-rooms-dialogs")["ManageRoomsDialogs"]>
>(
  () => import("@/components/rooms/manage-rooms-dialogs").then((m) => m.ManageRoomsDialogs),
  (p) => Boolean(p.manageRoomsOpen || p.addRoomConfirmOpen),
);

/* ---- ops / misc ---- */

export const MaintenanceLogSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/ops/maintenance-log-sheet")["MaintenanceLogSheet"]>
>(() => import("@/components/ops/maintenance-log-sheet").then((m) => m.MaintenanceLogSheet), openProp);

export const MaintenanceAreasSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/ops/maintenance-areas-sheet")["MaintenanceAreasSheet"]>
>(() => import("@/components/ops/maintenance-areas-sheet").then((m) => m.MaintenanceAreasSheet), openProp);

export const StayoverPhotosSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/stayover-photos-sheet")["StayoverPhotosSheet"]>
>(() => import("@/components/stayover-photos-sheet").then((m) => m.StayoverPhotosSheet), openProp);

export const NotificationsSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/notifications-sheet")["NotificationsSheet"]>
>(() => import("@/components/notifications-sheet").then((m) => m.NotificationsSheet), openProp);

export const MessagesSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/messages-sheet")["MessagesSheet"]>
>(() => import("@/components/messages-sheet").then((m) => m.MessagesSheet), openProp);

export const LostPropertySheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/lost-property-sheet")["LostPropertySheet"]>
>(() => import("@/components/lost-property-sheet").then((m) => m.LostPropertySheet), openProp);

export const QuickReceptionSheet = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/quick-reception-sheet")["QuickReceptionSheet"]>
>(() => import("@/components/quick-reception-sheet").then((m) => m.QuickReceptionSheet), openProp);

export const AccountDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/account-dialog")["AccountDialog"]>
>(() => import("@/components/account-dialog").then((m) => m.AccountDialog), openProp);

export const UsersDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/users-dialog")["UsersDialog"]>
>(() => import("@/components/users-dialog").then((m) => m.UsersDialog), openProp);

export const UserApprovalDialog = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/user-approval-dialog")["UserApprovalDialog"]>
>(() => import("@/components/user-approval-dialog").then((m) => m.UserApprovalDialog), openProp);

export const MaintenanceDashboard = makeLazyPanel<
  React.ComponentProps<typeof import("@/components/ops/maintenance-dashboard")["MaintenanceDashboard"]>
>(() => import("@/components/ops/maintenance-dashboard").then((m) => m.MaintenanceDashboard), () => true);
