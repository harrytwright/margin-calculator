/**
 * Cookie Consent Management
 * Handles GDPR-compliant cookie consent banner and preferences
 */

const CONSENT_KEY = 'menubook_cookie_consent'

/**
 * Check if user has already given/denied consent
 * @returns {'accepted'|'declined'|null}
 */
export function getConsentStatus() {
  try {
    return localStorage.getItem(CONSENT_KEY)
  } catch (e) {
    return null
  }
}

/**
 * Save user's consent preference
 * @param {'accepted'|'declined'} status
 */
export function setConsentStatus(status) {
  try {
    localStorage.setItem(CONSENT_KEY, status)
  } catch (e) {
    console.warn('Unable to save consent preference')
  }
}

/**
 * Create and show cookie consent banner
 * @param {Function} onAccept - Callback when user accepts
 * @param {Function} onDecline - Callback when user declines
 */
export function showConsentBanner(onAccept, onDecline) {
  const existing = getConsentStatus()

  // Don't show if already decided
  if (existing) {
    if (existing === 'accepted' && onAccept) {
      onAccept()
    }
    return
  }

  // Create banner HTML
  const banner = document.createElement('div')
  banner.id = 'cookie-consent-banner'
  banner.className = 'cookie-consent-banner'
  banner.innerHTML = `
    <div class="cookie-consent-content">
      <p class="cookie-consent-text">
        We use cookies to improve your experience and analyze site traffic.
        <a href="./cookies.html" target="_blank" class="cookie-consent-link">Learn more</a>
      </p>
      <div class="cookie-consent-buttons">
        <button id="cookie-decline" class="cookie-consent-btn cookie-consent-btn-secondary">
          Decline
        </button>
        <button id="cookie-accept" class="cookie-consent-btn cookie-consent-btn-primary">
          Accept
        </button>
      </div>
    </div>
  `

  // Add to page
  document.body.appendChild(banner)

  // Handle accept
  document.getElementById('cookie-accept').addEventListener('click', () => {
    setConsentStatus('accepted')
    banner.classList.add('cookie-consent-hidden')
    setTimeout(() => banner.remove(), 300)
    if (onAccept) onAccept()
  })

  // Handle decline
  document.getElementById('cookie-decline').addEventListener('click', () => {
    setConsentStatus('declined')
    banner.classList.add('cookie-consent-hidden')
    setTimeout(() => banner.remove(), 300)
    if (onDecline) onDecline()
  })

  // Show banner with animation
  requestAnimationFrame(() => {
    banner.classList.add('cookie-consent-visible')
  })
}

/**
 * Check if analytics consent was given
 * @returns {boolean}
 */
export function hasAnalyticsConsent() {
  return getConsentStatus() === 'accepted'
}
