import * as Sentry from "@sentry/nextjs"

import { sentryDsn, sentryOptions } from "./lib/sentry-options"

if (sentryDsn) {
  Sentry.init(sentryOptions)
}

export const onRouterTransitionStart = sentryDsn ? Sentry.captureRouterTransitionStart : undefined
