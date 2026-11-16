import * as React from 'react'
import { TsuyuEmail } from './_tsuyu-layout'

interface InviteEmailProps { siteName: string; siteUrl: string; confirmationUrl: string }

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <TsuyuEmail preview="You're invited to Tsuyu" heading="You're invited to Tsuyu" text="You've been invited to join your hotel's team on Tsuyu." buttonLabel="Accept invite" url={confirmationUrl} />
)

export default InviteEmail
