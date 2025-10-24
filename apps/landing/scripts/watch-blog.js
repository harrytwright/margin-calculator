#!/usr/bin/env node

/**
 * Watch Blog
 * Watches markdown files and rebuilds blog on changes
 */

import chokidar from 'chokidar'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const POSTS_DIR = path.join(__dirname, '../src/blog/posts')

console.log('👀 Watching blog posts for changes...')
console.log(`   ${POSTS_DIR}/**/*.md\n`)

// Watch markdown files
const watcher = chokidar.watch(`${POSTS_DIR}/**/*.md`, {
  persistent: true,
  ignoreInitial: true,
})

watcher
  .on('add', (filePath) => {
    console.log(`📝 New post detected: ${path.basename(filePath)}`)
    rebuildBlog()
  })
  .on('change', (filePath) => {
    console.log(`📝 Post changed: ${path.basename(filePath)}`)
    rebuildBlog()
  })
  .on('unlink', (filePath) => {
    console.log(`🗑️  Post deleted: ${path.basename(filePath)}`)
    rebuildBlog()
  })

function rebuildBlog() {
  try {
    execSync('node scripts/build-blog.js', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    })
    console.log('✨ Blog rebuilt successfully\n')
  } catch (error) {
    console.error('❌ Blog rebuild failed:', error.message)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping blog watcher...')
  watcher.close()
  process.exit(0)
})
