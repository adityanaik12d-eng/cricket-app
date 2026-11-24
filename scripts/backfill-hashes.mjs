#!/usr/bin/env node
/**
 * One-time backfill script to set scorerTokenHash on matches that have neither
 * ownerId nor scorerTokenHash (legacy first-writer claim rows).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local file.
 * Defaults to dry-run mode (prints what it would set without writing).
 *
 * Usage:
 *   DRY_RUN=false node scripts/backfill-hashes.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex')
}

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const envPath = resolve(__dirname, '../.env.local')
  const content = readFileSync(envPath, 'utf-8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim()
        const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '')
        env[key] = value
      }
    }
  }
  return env
}

const env = loadEnv()

function getEnv(name) {
  const val = env[name] || process.env[name]
  if (!val) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return val
}

async function main() {
  const url = getEnv('SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  const dryRun = (env.DRY_RUN || process.env.DRY_RUN) !== 'false' // defaults to true

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  })

  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE (will write)'}`)
  console.log('Fetching matches with ownerId IS NULL AND scorerTokenHash IS NULL...')

  let totalFetched = 0
  let totalWouldUpdate = 0
  let page = 0
  const pageSize = 500

  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, config, updated_at')
      .filter('config->>ownerId', 'is', null)
      .filter('config->>scorerTokenHash', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (error) {
      console.error('Fetch error:', error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) break

    totalFetched += data.length
    console.log(`Page ${page + 1}: ${data.length} matches`)

    for (const row of data) {
      const config = row.config
      const token = config.scorerToken

      // Check if there's a scorerToken in the config that we can hash
      // (this is the legacy claim token stored by the first writer)
      if (token && typeof token === 'string' && token.length > 0) {
        const hash = await sha256Hex(token)
        totalWouldUpdate++
        console.log(`  ${row.id}: has scorerToken, would set scorerTokenHash=${hash.slice(0, 16)}...`)

        if (!dryRun) {
          const newConfig = { ...config, scorerTokenHash: hash }
          const { error: updErr } = await supabase
            .from('matches')
            .update({ config: newConfig, updated_at: new Date().toISOString() })
            .eq('id', row.id)
          if (updErr) {
            console.error(`    UPDATE FAILED: ${updErr.message}`)
          } else {
            console.log(`    UPDATED`)
          }
        }
      } else {
        console.log(`  ${row.id}: NO scorerToken in config - cannot backfill, needs manual review`)
      }
    }

    page++
  }

  console.log(`\nTotal fetched: ${totalFetched}`)
  console.log(`Would update: ${totalWouldUpdate}`)
  if (dryRun) {
    console.log('\nThis was a dry run. To execute, run with DRY_RUN=false')
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})