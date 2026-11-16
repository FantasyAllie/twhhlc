import * as React from 'react'
import { Body, Button, Container, Font, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text } from '@react-email/components'

const LOGO = 'https://twhh.site/favicon-512.png'
const NAVY = '#132238'
const PARCHMENT = '#F7F4EE'
const MUTED = '#5B6475'
const GOLD = '#E2A54E'
const FONT = "Figtree, Helvetica, Arial, sans-serif"

export function TsuyuEmail({ preview, heading, text, buttonLabel, url, children }: {
  preview: string; heading: string; text: React.ReactNode; buttonLabel?: string; url?: string; children?: React.ReactNode
}) {
  return (
    <Html lang="en-GB" dir="ltr">
      <Head>
        <Font fontFamily="Figtree" fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif'] as any}
          webFont={{ url: 'https://fonts.gstatic.com/s/figtree/v5/_Xms-HUzqDCFdgfMm4S9DQ.woff2', format: 'woff2' }}
          fontWeight={400} fontStyle="normal" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: PARCHMENT, fontFamily: FONT, margin: 0, padding: '24px 12px' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Section style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <Img src={LOGO} width="64" height="64" alt="Tsuyu" style={{ margin: '0 auto' }} />
            <Text style={{ color: NAVY, fontWeight: 700, fontSize: '20px', margin: '8px 0 0' }}>Tsuyu</Text>
          </Section>
          <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '28px 24px' }}>
            <Heading style={{ color: NAVY, fontSize: '22px', fontWeight: 700, margin: '0 0 10px' }}>{heading}</Heading>
            <Hr style={{ borderTop: `2px solid ${GOLD}`, borderBottom: 'none', width: '48px', margin: '0 0 18px', marginLeft: 0 }} />
            <Text style={{ color: NAVY, fontSize: '15px', lineHeight: '1.55', margin: '0 0 22px' }}>{text}</Text>
            {children}
            {url && buttonLabel ? (
              <>
                <Button href={url} style={{ backgroundColor: NAVY, color: PARCHMENT, fontWeight: 700, fontSize: '15px', borderRadius: '999px', padding: '13px 26px', textDecoration: 'none' }}>{buttonLabel}</Button>
                <Text style={{ color: MUTED, fontSize: '12px', lineHeight: '1.5', margin: '22px 0 0' }}>
                  If the button doesn't work, copy this link into your browser:<br />
                  <Link href={url} style={{ color: MUTED, wordBreak: 'break-all' }}>{url}</Link>
                </Text>
              </>
            ) : null}
          </Section>
          <Text style={{ color: '#8A909C', fontSize: '12px', textAlign: 'center', margin: '18px 0 0' }}>Tsuyu · Hotel operations, all in one place</Text>
        </Container>
      </Body>
    </Html>
  )
}
