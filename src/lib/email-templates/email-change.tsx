import * as React from 'react'
import { TsuyuEmail } from './_tsuyu-layout'

interface EmailChangeEmailProps { siteName: string; oldEmail: string; email: string; newEmail: string; confirmationUrl: string }

export const EmailChangeEmail = ({ confirmationUrl }: EmailChangeEmailProps) => (
  <TsuyuEmail preview="Confirm your new email for Tsuyu" heading="Confirm your new email for Tsuyu" text="Confirm this is the new email address for your Tsuyu account." buttonLabel="Confirm new email" url={confirmationUrl} />
)

export default EmailChangeEmail
