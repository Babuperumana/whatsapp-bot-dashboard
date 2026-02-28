import { getAggregateVotesInPollMessage, decryptPollVote, updateMessageWithPollUpdate, jidNormalizedUser, getKeyAuthor } from '@kelvdra/baileys'

// Track active polls: pollMsgId -> { msg (full WAMessage), createdAt }
const activePolls = new Map()

// Poll results history: pollId -> latest result object
const pollHistory = new Map()

// Reference to the in-memory store (injected so we can look up unknown polls)
let _store = null
export function setStore(store) { _store = store }

/**
 * Register a poll message after sending
 */
export function registerPoll(pollMsg) {
  if (!pollMsg?.key?.id) return
  activePolls.set(pollMsg.key.id, {
    msg: pollMsg,   // full WAMessage object
    createdAt: Date.now(),
  })
}

/**
 * Extract the poll question from a full WAMessage object
 */
function extractQuestion(fullMsg) {
  const m = fullMsg?.message
  return (
    m?.pollCreationMessage?.name ||
    m?.pollCreationMessageV2?.name ||
    m?.pollCreationMessageV3?.name ||
    'Poll'
  )
}

/**
 * Handle messages.update event to aggregate poll votes.
 * Falls back to the store for polls not explicitly registered.
 * Returns { pollId, question, jid, results, timestamp } or null
 */
export function handlePollUpdate(updates, meId) {
  for (const update of updates) {
    if (!update.pollUpdates) continue

    const pollId = update.key?.id
    const jid    = update.key?.remoteJid

    // 1. Try the in-memory registry
    let pollEntry = activePolls.get(pollId)

    // 2. Fall back to the Baileys store
    if (!pollEntry && _store) {
      try {
        const msgs = _store.messages[jid]
        if (msgs) {
          const all = msgs.array ?? msgs.toJSON?.() ?? Object.values(msgs)
          // full WAMessage has key.id and message (inner content)
          const found = all.find(m => m.key?.id === pollId && m.message)
          if (found) {
            pollEntry = { msg: found, createdAt: Date.now() }
            activePolls.set(pollId, pollEntry)
          }
        }
      } catch {}
    }

    if (!pollEntry) continue

    // getAggregateVotesInPollMessage expects the full WAMessage object
    const votes = getAggregateVotesInPollMessage(
      { ...pollEntry.msg, pollUpdates: update.pollUpdates },
      meId
    )

    const question = extractQuestion(pollEntry.msg)
    const result = {
      pollId,
      jid,
      question,
      results: votes.map(v => ({ option: v.name, voters: v.voters, count: v.voters.length })),
      timestamp: Date.now(),
    }

    // Store in history (overwrites previous result for same poll = latest tally)
    pollHistory.set(pollId, result)

    return result
  }
  return null
}

/**
 * Get all poll results history, newest first
 */
export function getPollHistory() {
  return Array.from(pollHistory.values())
    .sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Handle a pollUpdateMessage from messages.upsert.
 * Group poll votes arrive as pollUpdateMessage in upsert (the commented-out
 * code in Baileys process-message.js that was supposed to do this is disabled).
 * We replicate it here manually.
 */
export async function handlePollUpdateMessage(sock, voteMsg) {
  try {
    const content = voteMsg.message?.pollUpdateMessage
    if (!content) return null

    const creationMsgKey = content.pollCreationMessageKey
    const pollId  = creationMsgKey?.id
    const jid     = voteMsg.key?.remoteJid

    if (!pollId) return null

    // Look up the original poll creation message
    let pollEntry = activePolls.get(pollId)
    if (!pollEntry && _store) {
      const lookupJids = [jid, creationMsgKey?.remoteJid].filter(Boolean)
      for (const lid of lookupJids) {
        const msgs = _store.messages[lid]
        if (!msgs) continue
        const all = msgs.array ?? msgs.toJSON?.() ?? Object.values(msgs)
        const found = all.find(m => m.key?.id === pollId && m.message)
        if (found) {
          pollEntry = { msg: found, createdAt: Date.now() }
          activePolls.set(pollId, pollEntry)
          break
        }
      }
    }

    if (!pollEntry) {
      console.log('[POLL] original poll not found for id:', pollId)
      return null
    }

    const pollCreationMsg = pollEntry.msg
    // The encryption key is stored in messageContextInfo.messageSecret
    const pollEncKey = pollCreationMsg.message?.messageContextInfo?.messageSecret
    if (!pollEncKey) {
      console.log('[POLL] no messageSecret (pollEncKey) found on poll creation message')
      return null
    }

    const meIdNorm    = jidNormalizedUser(sock.user?.id)
    const pollCreatorJid = getKeyAuthor(creationMsgKey, meIdNorm)
    const voterJid       = getKeyAuthor(voteMsg.key, meIdNorm)

    // Decrypt the vote
    const voteDecrypted = decryptPollVote(content.vote, {
      pollEncKey,
      pollCreatorJid,
      pollMsgId: pollId,
      voterJid,
    })

    // Apply the vote update to the poll message's pollUpdates array
    const senderTimestampMs = content.senderTimestampMs
      ? (typeof content.senderTimestampMs.toNumber === 'function'
          ? content.senderTimestampMs.toNumber()
          : Number(content.senderTimestampMs))
      : Date.now()

    updateMessageWithPollUpdate(pollCreationMsg, {
      pollUpdateMessageKey: voteMsg.key,
      vote: voteDecrypted,
      senderTimestampMs,
    })

    // Aggregate all votes accumulated so far
    const votes = getAggregateVotesInPollMessage(pollCreationMsg, meIdNorm)

    const question = extractQuestion(pollCreationMsg)
    const result = {
      pollId,
      jid,
      question,
      results: votes.map(v => ({ option: v.name, voters: v.voters, count: v.voters.length })),
      timestamp: Date.now(),
    }

    pollHistory.set(pollId, result)
    return result
  } catch (e) {
    console.error('[POLL] handlePollUpdateMessage error:', e.message)
    return null
  }
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
