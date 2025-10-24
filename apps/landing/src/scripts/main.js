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
  if (hasAnalyticsConsent()) {
    initPostHog()
  } else {
    // Show consent banner and init on acceptance
    showConsentBanner(
      () => {
        // User accepted - initialize PostHog
        initPostHog()
      },
      () => {
        // User declined - do nothing (no analytics)
        console.log('Analytics cookies declined')
      }
    )
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
