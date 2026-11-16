import * as React from 'react'
import { TsuyuEmail } from './_tsuyu-layout'

interface MagicLinkEmailProps { siteName: string; confirmationUrl: string }

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <TsuyuEmail preview="Your Tsuyu sign-in link" heading="Your Tsuyu sign-in link" text="Use this button to sign in to Tsuyu. The link works once." buttonLabel="Sign in" url={confirmationUrl} />
)

export default MagicLinkEmail
