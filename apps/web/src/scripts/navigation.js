/**
 * Navigation functionality
 */

/**
 * Smooth scroll for anchor links
 */
export function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault()
      const target = document.querySelector(this.getAttribute('href'))
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Close mobile menu if open
        closeMobileMenu()
      }
    })
  })
}

/**
 * Mobile menu toggle
 */
export function setupMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn')
  const menu = document.getElementById('mobile-menu')

  if (!menuBtn || !menu) return

  menuBtn.addEventListener('click', () => {
    const isOpen = !menu.classList.contains('hidden')

    if (isOpen) {
      closeMobileMenu()
    } else {
      openMobileMenu()
    }
  })

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!menuBtn.contains(e.target) && !menu.contains(e.target)) {
      closeMobileMenu()
    }
  })

  // Close menu on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu()
    }
  })
}

function openMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn')
  const menu = document.getElementById('mobile-menu')

  if (!menuBtn || !menu) return

  menu.classList.remove('hidden')
  menuBtn.setAttribute('aria-expanded', 'true')

  // Update icon to X
  menuBtn.innerHTML = `
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  `
}

function closeMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn')
  const menu = document.getElementById('mobile-menu')

  if (!menuBtn || !menu) return

  menu.classList.add('hidden')
  menuBtn.setAttribute('aria-expanded', 'false')

  // Update icon to hamburger
  menuBtn.innerHTML = `
    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  `
}
