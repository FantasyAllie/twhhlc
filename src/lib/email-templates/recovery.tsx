import * as React from 'react'
import { TsuyuEmail } from './_tsuyu-layout'

interface RecoveryEmailProps { siteName: string; confirmationUrl: string }

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <TsuyuEmail preview="Reset your Tsuyu password" heading="Reset your Tsuyu password" text="Someone asked to reset the password for this Tsuyu account. If it was you, choose a new one below. If not, you can ignore this email." buttonLabel="Choose a new password" url={confirmationUrl} />
)

export default RecoveryEmail
