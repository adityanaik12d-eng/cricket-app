#!/usr/bin/env node
/**
 * One-time backfill script to set finished_at on existing finished matches.
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local file.
 * Defaults to dry-run mode (prints what it would set without writing).
 * Uses core applyEvents to decide which matches are finished (status: COMPLETED/TIED/ABANDONED).
 *
 * Usage:
 *   DRY_RUN=false node scripts/backfill-finished-at.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { applyEvents } from '@cricket-app/core'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const FINISHED_STATUSES = new Set(['COMPLETED', 'TIED', 'ABANDONED'])

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
  console.log('Fetching matches with finished_at IS NULL...')

  let totalFetched = 0
  let totalWouldUpdate = 0
  let page = 0
  const pageSize = 500

  while (true) {
    const { data, error } = await supabase
      .from('matches')
      .select('id, config, events, updated_at')
      .is('finished_at', null)
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
      const events = (row.events ?? [])

      try {
        const state = applyEvents(config, events)
        if (FINISHED_STATUSES.has(state.status)) {
          // Find the timestamp of the event that caused the finish
          // Prefer END_MATCH event ts, otherwise the last event ts
          let finishedAt = null
          for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].type === 'END_MATCH') {
              finishedAt = events[i].ts
              break
            }
          }
          if (!finishedAt && events.length > 0) {
            finishedAt = events[events.length - 1].ts
          }

          if (finishedAt) {
            totalWouldUpdate++
            console.log(`  ${row.id}: status=${state.status} -> finished_at=${finishedAt}`)

            if (!dryRun) {
              const { error: updErr } = await supabase
                .from('matches')
                .update({ finished_at: finishedAt })
                .eq('id', row.id)
              if (updErr) {
                console.error(`    UPDATE FAILED: ${updErr.message}`)
              } else {
                console.log(`    UPDATED`)
              }
            }
          } else {
            console.log(`  ${row.id}: status=${state.status} but no events to derive timestamp, skipping`)
          }
        }
      } catch (e) {
        console.error(`  ${row.id}: replay failed, skipping - ${e.message}`)
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