/**
 * presence.js
 * Handle presence.update events (typing, online, offline)
 */

export function onPresenceUpdate({ id, presences }, io) {
  for (const [participant, presence] of Object.entries(presences)) {
    io?.emit('presence', {
      chatId: id,
      participant,
      status: presence.lastKnownPresence,
      lastSeen: presence.lastSeen,
    })
  }
}
