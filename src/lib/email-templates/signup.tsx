import * as React from 'react'
import { TsuyuEmail } from './_tsuyu-layout'

interface SignupEmailProps { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

export const SignupEmail = ({ confirmationUrl }: SignupEmailProps) => (
  <TsuyuEmail preview="Confirm your Tsuyu account" heading="Confirm your Tsuyu account" text="Thanks for joining Tsuyu. Confirm your email address and your manager can give you access to your hotel." buttonLabel="Confirm email" url={confirmationUrl} />
)

export default SignupEmail
