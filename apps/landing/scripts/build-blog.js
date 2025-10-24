#!/usr/bin/env node

/**
 * Build Blog
 * Generates HTML pages from markdown posts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import matter from 'gray-matter'
import { marked } from 'marked'

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
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${post.title} - Menu Book Blog</title>
    <meta name="description" content="${post.excerpt}" />

    <!-- SEO Meta Tags -->
    <meta name="author" content="${post.author}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${SITE_URL}/blog/${post.slug}" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${SITE_URL}/blog/${post.slug}" />
    <meta property="og:title" content="${post.title}" />
    <meta property="og:description" content="${post.excerpt}" />
    <meta property="og:site_name" content="Menu Book Blog" />
    <meta property="article:published_time" content="${post.date}" />
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

    <!-- Styles -->
    <link rel="stylesheet" href="../styles.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown-light.min.css" integrity="sha512-X175XRJAO6PHAUi8AA7GP8uUF5Wiv+w9bOi64i02CHKDQBsO1yy0jLSKaUKg/NhRCDYBmOLQCfKaTaXiyZlLrw==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    
    <style>
        .markdown-body {
            background-color: inherit;
        }
    </style>
    <!-- Scripts -->
    <script type="module" src="../scripts/main.js"></script>
  </head>
  <body class="bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-2">
            <a href="/" class="text-xl font-bold text-gray-900">Menu Book</a>
          </div>
          <nav class="hidden md:flex space-x-8">
            <a href="/#features" class="text-gray-600 hover:text-gray-900">Features</a>
            <a href="/#demo" class="text-gray-600 hover:text-gray-900">Demo</a>
            <a href="/#pricing" class="text-gray-600 hover:text-gray-900">Pricing</a>
            <a href="/blog" class="text-blue-600 hover:text-blue-700 font-medium">Blog</a>
          </nav>
          <div>
            <a href="/#signup" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Get Early Access
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Blog Post -->
    <article class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <!-- Back to blog -->
      <a href="/blog" class="inline-flex items-center text-blue-600 hover:text-blue-700 mb-8">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Back to Blog
      </a>

      <!-- Post header -->
      <header class="mb-12">
        <h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">${post.title}</h1>
        <div class="flex items-center text-gray-600 space-x-4">
          <time datetime="${post.date}">${formatDate(post.date)}</time>
          <span>•</span>
          <span>${post.readingTime} min read</span>
          <span>•</span>
          <span>By ${post.author}</span>
        </div>
      </header>

      <!-- Post content -->
      <div class="prose prose-lg markdown-body max-w-none">
        ${post.html}
      </div>

      <!-- Post footer -->
      <footer class="mt-16 pt-8 border-t border-gray-200">
        <div class="bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-2xl">
          <h3 class="text-2xl font-bold text-gray-900 mb-4">Want to follow our journey?</h3>
          <p class="text-gray-700 mb-6">Join our waitlist to get updates when we launch and exclusive early access.</p>
          <a href="/#signup" class="inline-block bg-gradient-to-br from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg font-bold hover:shadow-xl transition-all">
            Join the Waitlist
          </a>
        </div>
      </footer>
    </article>

    <!-- Footer -->
    <footer class="bg-gray-900 text-gray-400 py-12 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p>&copy; 2025 Menu Book. All rights reserved.</p>
        <p class="mt-2">Created by GoBowling Shipley Lanes</p>
        <div class="mt-4 space-x-4">
          <a href="../privacy.html" class="hover:text-white">Privacy Policy</a>
          <a href="../terms.html" class="hover:text-white">Terms of Service</a>
          <a href="../cookies.html" class="hover:text-white">Cookie Policy</a>
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
    <article class="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
      <time class="text-sm text-gray-500" datetime="${post.date}">${formatDate(post.date)}</time>
      <h2 class="text-2xl font-bold text-gray-900 mt-2 mb-3">
        <a href="/blog/${post.slug}" class="hover:text-blue-600">${post.title}</a>
      </h2>
      <p class="text-gray-600 mb-4">${post.excerpt}</p>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-500">${post.readingTime} min read</span>
        <a href="/blog/${post.slug}" class="text-blue-600 hover:text-blue-700 font-medium">
          Read more →
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

    <!-- SEO Meta Tags -->
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${SITE_URL}/blog" />
    <link rel="alternate" type="application/rss+xml" title="Menu Book Blog" href="${SITE_URL}/blog/rss.xml" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_URL}/blog" />
    <meta property="og:title" content="Menu Book Blog - Building in Public" />
    <meta property="og:description" content="Follow our journey building Menu Book, a modern recipe cost calculator for food service businesses." />
    <meta property="og:site_name" content="Menu Book" />

    <!-- Favicons -->
    <link rel="icon" href="../assets/favicon.ico" sizes="32x32" />
    <link rel="icon" href="../assets/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="../assets/apple-touch-icon.png" />

    <!-- Styles -->
    <link rel="stylesheet" href="../styles.css" />

    <!-- Scripts -->
    <script type="module" src="../scripts/main.js"></script>
  </head>
  <body class="bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-2">
            <a href="/" class="text-xl font-bold text-gray-900">Menu Book</a>
          </div>
          <nav class="hidden md:flex space-x-8">
            <a href="/#features" class="text-gray-600 hover:text-gray-900">Features</a>
            <a href="/#demo" class="text-gray-600 hover:text-gray-900">Demo</a>
            <a href="/#pricing" class="text-gray-600 hover:text-gray-900">Pricing</a>
            <a href="/blog" class="text-blue-600 hover:text-blue-700 font-medium">Blog</a>
          </nav>
          <div>
            <a href="/#signup" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Get Early Access
            </a>
          </div>
        </div>
      </div>
    </header>

    <!-- Blog Header -->
    <section class="bg-gradient-to-br from-blue-600 to-purple-600 text-white py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-5xl font-bold mb-4">Menu Book Blog</h1>
        <p class="text-xl text-purple-100 max-w-2xl mx-auto">
          Building in public: Follow our journey creating a modern recipe cost calculator
        </p>
      </div>
    </section>

    <!-- Blog Posts -->
    <section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div class="grid md:grid-cols-2 gap-8">
        ${postCards}
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-900 text-gray-400 py-12 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p>&copy; 2025 Menu Book. All rights reserved.</p>
        <p class="mt-2">Created by GoBowling Shipley Lanes</p>
        <div class="mt-4 space-x-4">
          <a href="../privacy.html" class="hover:text-white">Privacy Policy</a>
          <a href="../terms.html" class="hover:text-white">Terms of Service</a>
          <a href="../cookies.html" class="hover:text-white">Cookie Policy</a>
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

  console.log(`\n✨ Built ${posts.length} blog post(s)`)
}

// Run build
buildBlog().catch((error) => {
  console.error('❌ Build failed:', error)
  process.exit(1)
})
