import * as React from 'react'
import { Text } from '@react-email/components'
import { TsuyuEmail } from './_tsuyu-layout'

interface ReauthenticationEmailProps { token: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <TsuyuEmail preview="Your Tsuyu verification code" heading="Your Tsuyu verification code" text="Use this code to confirm it's you. It expires shortly.">
    <Text style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '6px', color: '#132238', margin: 0 }}>{token}</Text>
  </TsuyuEmail>
)

export default ReauthenticationEmail
