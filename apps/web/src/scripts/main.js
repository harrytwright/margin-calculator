/**
 * Menu Book Landing Page
 * Main entry point for JavaScript functionality
 */

import { initPostHog } from './analytics'
import { hasAnalyticsConsent, showConsentBanner } from './consent'
import { initDemo } from './demo'
import { setupWaitlistForm } from './forms'
import { setupSmoothScroll } from './navigation'

// Initialize analytics only with consent
function initializeAnalytics() {
  initPostHog()

  console.log(hasAnalyticsConsent())

  if (!hasAnalyticsConsent()) {
    // Show consent banner and init on acceptance
    showConsentBanner(
      () => posthog?.opt_in_capturing(),
      () => posthog?.opt_out_capturing()
    )
  } else {
    posthog?.opt_in_capturing()
  }
}

// Initialize analytics
initializeAnalytics()

// Set up interactions
document.addEventListener('DOMContentLoaded', () => {
  setupWaitlistForm()
  setupSmoothScroll()
  initDemo()
})
