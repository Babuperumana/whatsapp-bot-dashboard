import { getAggregateVotesInPollMessage } from '@kelvdra/baileys'

// Track active polls: pollMsgId -> { question, options, msg }
const activePolls = new Map()

/**
 * Register a poll message after sending
 */
export function registerPoll(pollMsg) {
  if (!pollMsg?.key?.id) return
  activePolls.set(pollMsg.key.id, {
    msg: pollMsg,
    createdAt: Date.now(),
  })
}

/**
 * Handle messages.update event to aggregate poll votes
 * Returns { pollId, results } or null
 */
export function handlePollUpdate(updates, meId) {
  for (const update of updates) {
    if (!update.pollUpdates) continue

    const pollId = update.key?.id
    const pollEntry = activePolls.get(pollId)
    if (!pollEntry) continue

    const votes = getAggregateVotesInPollMessage(
      { message: pollEntry.msg, pollUpdates: update.pollUpdates },
      meId
    )

    return {
      pollId,
      jid: update.key?.remoteJid,
      results: votes.map(v => ({ option: v.name, voters: v.voters, count: v.voters.length })),
    }
  }
  return null
}

/**
 * Get all active polls
 */
export function getActivePolls() {
  return Array.from(activePolls.entries()).map(([id, data]) => ({
    id,
    createdAt: data.createdAt,
  }))
}

/**
 * Clear old polls (older than 24h)
 */
export function cleanupPolls() {
  const cutoff = Date.now() - 86400_000
  for (const [id, data] of activePolls) {
    if (data.createdAt < cutoff) activePolls.delete(id)
  }
}
