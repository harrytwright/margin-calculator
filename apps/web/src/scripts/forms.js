/**
 * Waitlist Form Handler
 */

import { trackWaitlistSignup } from './analytics'

export function setupWaitlistForm() {
  const form = document.getElementById('signup-form')
  if (!form) return

  form.addEventListener('submit', function (e) {
    const email = document.getElementById('email').value

    // Track the signup in PostHog
    trackWaitlistSignup(email)

    // Form will submit to Formsubmit.co naturally
  })
}
