CREATE POLICY "Housekeeping reads hotel activity" ON public.activity_events
FOR SELECT TO authenticated
USING (
  private.can_access_hotel(hotel_id)
  AND private.has_role(auth.uid(), 'housekeeper')
);