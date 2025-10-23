/**
 * Menu Book Landing Page
 * Main entry point for JavaScript functionality
 */

import { initPostHog } from './analytics'
import { setupWaitlistForm } from './forms'
import { setupSmoothScroll } from './navigation'

// Initialize analytics
initPostHog()

// Set up interactions
document.addEventListener('DOMContentLoaded', () => {
  setupWaitlistForm()
  setupSmoothScroll()
})
