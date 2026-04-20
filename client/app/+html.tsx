import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>ObitNote - Obituary Monitoring & Alert Service</title>
        <meta name="description" content="ObitNote is an obituary monitoring and alert service.  Get notified when an obituary is published for someone you care about.  Daily obituary watch across the US, Canada, the UK, Australia, and New Zealand with email and text notifications." />
        <meta name="keywords" content="obituary alert, obituary notification, obituary monitoring, obituary watch, death notification service, funeral notification" />
        <link rel="canonical" href="https://obitnote.com" />

        {/* Open Graph (Facebook, iMessage, Slack, LinkedIn link previews) */}
        <meta property="og:title" content="ObitNote - Obituary Monitoring & Alert Service" />
        <meta property="og:description" content="Get notified when an obituary is published for someone you care about.  ObitNote searches daily and sends you a text and email." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://obitnote.com" />
        <meta property="og:site_name" content="ObitNote" />

        {/* Twitter/X card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="ObitNote - Obituary Monitoring & Alert Service" />
        <meta name="twitter:description" content="Get notified when an obituary is published for someone you care about." />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
