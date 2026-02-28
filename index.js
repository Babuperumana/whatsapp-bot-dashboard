/**
 * WhatsApp Bot — Main Entry Point
 * Features: All message types, interactive messages, groups, polls,
 *           media, presence, calls + Web Dashboard (Express + Socket.IO)
 */

import { connectToWhatsApp, setIO, getSock, store } from './bot/connection.js'
import { createWebServer } from './web/server.js'
import { onMessagesUpsert, onMessagesUpdate } from './bot/handlers/messages.js'
import { onCall } from './bot/handlers/calls.js'
import { onPresenceUpdate } from './bot/handlers/presence.js'
import { initScheduler } from './bot/scheduler.js'
import { setStore } from './bot/features/pollManager.js'

const PORT = process.env.PORT || 3000

async function main() {
  // ── Start web server ────────────────────────────────────────────────────
  const { httpServer, io } = createWebServer()

  httpServer.listen(PORT, () => {
    console.log(`\n🌐 Web Dashboard: http://localhost:${PORT}\n`)
  })

  // ── Inject Socket.IO into the bot connection module ─────────────────────
  setIO(io)

  // ── Connect to WhatsApp ─────────────────────────────────────────────────
  setStore(store)
  const sock = await connectToWhatsApp()
  setupBotHandlers(sock, io)
  initScheduler(getSock, io)
}

function setupBotHandlers(sock, io) {
  // Messages
  sock.ev.on('messages.upsert', (data) => onMessagesUpsert(sock, data, io))
  sock.ev.on('messages.update', (updates) => onMessagesUpdate(sock, updates, io))

  // Calls (auto-reject disabled by default — change 3rd arg to true to enable)
  sock.ev.on('call', (calls) => onCall(sock, calls, io, false))

  // Presence
  sock.ev.on('presence.update', (data) => onPresenceUpdate(data, io))

  // Group participants
  sock.ev.on('group-participants.update', (update) => {
    console.log('Group participants update:', update.action, update.id)
    io?.emit('wa_event', { event: 'group-participants.update', data: update })
  })

  // Join requests
  sock.ev.on('group.join-request', (request) => {
    console.log('Group join request:', request)
    io?.emit('wa_event', { event: 'group.join-request', data: request })
  })

  console.log('✅ Bot handlers registered')
}

main().catch(console.error)

// ── Graceful shutdown ──────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\nShutting down…')
  try {
    store.writeToFile('./baileys_store.json')
    const sock = getSock()
    if (sock) await sock.end(undefined)
  } catch {}
  process.exit(0)
})
