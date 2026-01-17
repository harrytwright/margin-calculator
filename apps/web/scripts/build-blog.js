#!/usr/bin/env node

/**
 * Build Blog
 * Generates HTML pages from markdown posts
 */

import fs from 'fs'
import matter from 'gray-matter'
import { marked } from 'marked'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const POSTS_DIR = path.join(__dirname, '../src/blog/posts')
const BLOG_DIR = path.join(__dirname, '../src/blog')
const SITE_URL = 'https://getmenubook.com'

/**
 * Calculate reading time
 */
function calculateReadingTime(content) {
  const wordsPerMinute = 200
  const words = content.trim().split(/\s+/).length
  const minutes = Math.ceil(words / wordsPerMinute)
  return minutes
}

/**
 * Format date
 */
function formatDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Generate blog post HTML
 */
function generatePostHTML(post) {
  const isoDate = new Date(post.date).toISOString()

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${post.title} - Menu Book Blog</title>
    <meta name="description" content="${post.excerpt}" />

    <!-- Preconnect for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <!-- SEO Meta Tags -->
    <meta name="author" content="${post.author}" />
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#2563EB" />
    <link rel="canonical" href="${SITE_URL}/blog/${post.slug}" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${SITE_URL}/blog/${post.slug}" />
    <meta property="og:title" content="${post.title}" />
    <meta property="og:description" content="${post.excerpt}" />
    <meta property="og:site_name" content="Menu Book" />
    <meta property="og:locale" content="en_GB" />
    <meta property="article:published_time" content="${isoDate}" />
    <meta property="article:author" content="${post.author}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${SITE_URL}/blog/${post.slug}" />
    <meta name="twitter:title" content="${post.title}" />
    <meta name="twitter:description" content="${post.excerpt}" />

    <!-- Favicons -->
    <link rel="icon" href="../assets/favicon.ico" sizes="32x32" />
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png" />

    <!-- Fonts -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" /></noscript>

    <!-- Styles -->
    <link rel="stylesheet" href="../styles.css" />

    <!-- Scripts -->
    <script type="module" src="../scripts/main.js"></script>

    <!-- Structured Data (JSON-LD) for Article -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": "${post.title}",
      "description": "${post.excerpt}",
      "author": {
        "@type": "Person",
        "name": "${post.author}"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Menu Book",
        "url": "${SITE_URL}"
      },
      "datePublished": "${isoDate}",
      "dateModified": "${isoDate}",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "${SITE_URL}/blog/${post.slug}"
      },
      "url": "${SITE_URL}/blog/${post.slug}"
    }
    </script>
  </head>
  <body>
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-fallback border-b border-neutral-100">
      <div class="container-main">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <a href="/" class="flex items-center gap-2">
            <span class="text-xl font-bold text-neutral-900">Menu Book</span>
          </a>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-8">
            <a href="/#features" class="nav-link">Features</a>
            <a href="/#demo" class="nav-link">Demo</a>
            <a href="/#pricing" class="nav-link">Pricing</a>
            <a href="/blog" class="nav-link text-primary-600">Blog</a>
          </nav>

          <!-- CTA Button -->
          <div class="flex items-center gap-4">
            <a href="/#signup" class="btn-primary hidden sm:inline-flex">
              Get Early Access
            </a>
            <!-- Mobile Menu Button -->
            <button
              type="button"
              id="mobile-menu-btn"
              class="btn-ghost md:hidden"
              aria-label="Toggle menu"
              aria-expanded="false"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation -->
        <nav id="mobile-menu" class="hidden md:hidden pb-4">
          <div class="flex flex-col gap-2">
            <a href="/#features" class="nav-link py-2">Features</a>
            <a href="/#demo" class="nav-link py-2">Demo</a>
            <a href="/#pricing" class="nav-link py-2">Pricing</a>
            <a href="/blog" class="nav-link py-2 text-primary-600">Blog</a>
            <a href="/#signup" class="btn-primary mt-2 sm:hidden">Get Early Access</a>
          </div>
        </nav>
      </div>
    </header>

    <!-- Blog Post -->
    <article class="section bg-white">
      <div class="container-narrow">
        <!-- Back to blog -->
        <a href="/blog" class="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium mb-8 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Blog
        </a>

        <!-- Post header -->
        <header class="mb-12">
          <h1 class="heading-1 mb-6">${post.title}</h1>
          <div class="flex flex-wrap items-center gap-3 text-neutral-500 body-small">
            <time datetime="${post.date}">${formatDate(post.date)}</time>
            <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
            <span>${post.readingTime} min read</span>
            <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
            <span>By ${post.author}</span>
          </div>
        </header>

        <!-- Post content -->
        <div class="prose">
          ${post.html}
        </div>

        <!-- Post footer -->
        <footer class="mt-16 pt-8 border-t border-neutral-200">
          <div class="card card-padding bg-primary-50 rounded-2xl">
            <h3 class="heading-4 mb-3">Want to follow our journey?</h3>
            <p class="body text-neutral-600 mb-6">Join our waitlist to get updates when we launch and exclusive early access.</p>
            <a href="/#signup" class="btn-primary">
              Join the Waitlist
            </a>
          </div>
        </footer>
      </div>
    </article>

    <!-- Footer -->
    <footer class="bg-white border-t border-neutral-200">
      <div class="container-main py-12">
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p class="body-small text-neutral-400">
            &copy; 2025 Menu Book. All rights reserved.
          </p>
          <div class="flex items-center gap-6">
            <a href="../privacy.html" class="link-subtle text-sm">Privacy Policy</a>
            <a href="../terms.html" class="link-subtle text-sm">Terms of Service</a>
            <a href="../cookies.html" class="link-subtle text-sm">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  </body>
</html>`
}

/**
 * Generate blog index HTML
 */
function generateIndexHTML(posts) {
  const postCards = posts
    .map(
      (post) => `
        <article class="card card-padding group">
          <time class="body-small text-neutral-500" datetime="${post.date}">${formatDate(post.date)}</time>
          <h2 class="heading-4 mt-2 mb-3">
            <a href="/blog/${post.slug}" class="text-neutral-900 group-hover:text-primary-600 transition-colors">${post.title}</a>
          </h2>
          <p class="body text-neutral-600 mb-4">${post.excerpt}</p>
          <div class="flex items-center justify-between">
            <span class="body-small text-neutral-500">${post.readingTime} min read</span>
            <a href="/blog/${post.slug}" class="text-primary-600 hover:text-primary-700 font-medium text-sm inline-flex items-center gap-1 transition-colors">
              Read more
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </article>
      `
    )
    .join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Blog - Menu Book</title>
    <meta name="description" content="Building in public: Follow our journey building Menu Book, a modern recipe cost calculator for food service businesses." />

    <!-- Preconnect for performance -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <!-- SEO Meta Tags -->
    <meta name="robots" content="index, follow" />
    <meta name="theme-color" content="#2563EB" />
    <link rel="canonical" href="${SITE_URL}/blog" />
    <link rel="alternate" type="application/rss+xml" title="Menu Book Blog" href="${SITE_URL}/blog/rss.xml" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_URL}/blog" />
    <meta property="og:title" content="Menu Book Blog - Building in Public" />
    <meta property="og:description" content="Follow our journey building Menu Book, a modern recipe cost calculator for food service businesses." />
    <meta property="og:site_name" content="Menu Book" />
    <meta property="og:locale" content="en_GB" />

    <!-- Favicons -->
    <link rel="icon" href="../assets/favicon.ico" sizes="32x32" />
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png" />

    <!-- Fonts -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'" />
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" /></noscript>

    <!-- Styles -->
    <link rel="stylesheet" href="../styles.css" />

    <!-- Scripts -->
    <script type="module" src="../scripts/main.js"></script>
  </head>
  <body>
    <!-- Header -->
    <header class="sticky top-0 z-50 bg-white/80 backdrop-blur-fallback border-b border-neutral-100">
      <div class="container-main">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <a href="/" class="flex items-center gap-2">
            <span class="text-xl font-bold text-neutral-900">Menu Book</span>
          </a>

          <!-- Desktop Navigation -->
          <nav class="hidden md:flex items-center gap-8">
            <a href="/#features" class="nav-link">Features</a>
            <a href="/#demo" class="nav-link">Demo</a>
            <a href="/#pricing" class="nav-link">Pricing</a>
            <a href="/blog" class="nav-link text-primary-600">Blog</a>
          </nav>

          <!-- CTA Button -->
          <div class="flex items-center gap-4">
            <a href="/#signup" class="btn-primary hidden sm:inline-flex">
              Get Early Access
            </a>
            <!-- Mobile Menu Button -->
            <button
              type="button"
              id="mobile-menu-btn"
              class="btn-ghost md:hidden"
              aria-label="Toggle menu"
              aria-expanded="false"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile Navigation -->
        <nav id="mobile-menu" class="hidden md:hidden pb-4">
          <div class="flex flex-col gap-2">
            <a href="/#features" class="nav-link py-2">Features</a>
            <a href="/#demo" class="nav-link py-2">Demo</a>
            <a href="/#pricing" class="nav-link py-2">Pricing</a>
            <a href="/blog" class="nav-link py-2 text-primary-600">Blog</a>
            <a href="/#signup" class="btn-primary mt-2 sm:hidden">Get Early Access</a>
          </div>
        </nav>
      </div>
    </header>

    <!-- Blog Header -->
    <section class="section-sm bg-white border-b border-neutral-100">
      <div class="container-main text-center">
        <p class="eyebrow mb-3">Building in Public</p>
        <h1 class="heading-1 mb-4">Menu Book Blog</h1>
        <p class="subheading max-w-2xl mx-auto">
          Follow our journey creating a modern recipe cost calculator for cafes, restaurants, and food service operators.
        </p>
      </div>
    </section>

    <!-- Blog Posts -->
    <section class="section bg-neutral-50">
      <div class="container-main">
        <div class="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          ${postCards}
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="section-sm bg-white border-t border-neutral-100">
      <div class="container-narrow text-center">
        <h2 class="heading-3 mb-4">Want to stay updated?</h2>
        <p class="body text-neutral-600 mb-6">
          Join our waitlist for early access and product updates.
        </p>
        <a href="/#signup" class="btn-primary">Join the Waitlist</a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-white border-t border-neutral-200">
      <div class="container-main py-12">
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p class="body-small text-neutral-400">
            &copy; 2025 Menu Book. All rights reserved.
          </p>
          <div class="flex items-center gap-6">
            <a href="../privacy.html" class="link-subtle text-sm">Privacy Policy</a>
            <a href="../terms.html" class="link-subtle text-sm">Terms of Service</a>
            <a href="../cookies.html" class="link-subtle text-sm">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  </body>
</html>`
}

/**
 * Generate RSS feed
 */
function generateRSS(posts) {
  const items = posts
    .map(
      (post) => `
    <item>
      <title>${post.title}</title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid>${SITE_URL}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${post.excerpt}</description>
      <author>${post.author}</author>
    </item>
  `
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Menu Book Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Building in public: Follow our journey building Menu Book</description>
    <language>en-gb</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`
}

/**
 * Generate sitemap.xml
 */
function generateSitemap(posts) {
  const now = new Date().toISOString()

  // Static pages
  const staticPages = [
    { url: '', priority: '1.0', changefreq: 'weekly' }, // Homepage
    { url: 'privacy.html', priority: '0.3', changefreq: 'monthly' },
    { url: 'terms.html', priority: '0.3', changefreq: 'monthly' },
    { url: 'cookies.html', priority: '0.3', changefreq: 'monthly' },
    { url: 'blog', priority: '0.8', changefreq: 'daily' }, // Blog index
  ]

  const staticUrls = staticPages
    .map(
      (page) => `
  <url>
    <loc>${SITE_URL}/${page.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('')

  // Blog post URLs
  const postUrls = posts
    .map(
      (post) => `
  <url>
    <loc>${SITE_URL}/blog/${post.slug}</loc>
    <lastmod>${new Date(post.date).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}${postUrls}
</urlset>`
}

/**
 * Main build function
 */
async function buildBlog() {
  console.log('📝 Building blog...')

  // Read all markdown files
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'))

  if (files.length === 0) {
    console.log('⚠️  No blog posts found')
    return
  }

  const posts = []

  // Process each post
  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file)
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(fileContent)

    // Parse markdown to HTML
    const html = marked(content)

    // Create post object
    const post = {
      ...data,
      html,
      readingTime: calculateReadingTime(content),
    }

    posts.push(post)

    // Generate post HTML file
    const postHTML = generatePostHTML(post)
    const postFilePath = path.join(BLOG_DIR, `${post.slug}.html`)
    fs.writeFileSync(postFilePath, postHTML)

    console.log(`✓ Generated ${post.slug}.html`)
  }

  // Sort posts by date (newest first)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date))

  // Generate blog index
  const indexHTML = generateIndexHTML(posts)
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), indexHTML)
  console.log('✓ Generated index.html')

  // Generate RSS feed
  const rss = generateRSS(posts)
  fs.writeFileSync(path.join(BLOG_DIR, 'rss.xml'), rss)
  console.log('✓ Generated rss.xml')

  // Generate sitemap (at root level)
  const sitemap = generateSitemap(posts)
  const sitemapPath = path.join(__dirname, '../src/sitemap.xml')
  fs.writeFileSync(sitemapPath, sitemap)
  console.log('✓ Generated sitemap.xml')

  console.log(`\n✨ Built ${posts.length} blog post(s)`)
}

// Run build
buildBlog().catch((error) => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})
