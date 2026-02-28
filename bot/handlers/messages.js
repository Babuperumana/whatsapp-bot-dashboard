import { getContentType } from '@kelvdra/baileys'
import { handleCommand } from './commands.js'
import { downloadMedia, bufferToDataUrl, extractText, getMessageTypeLabel } from '../features/mediaHandler.js'
import { handlePollUpdate, handlePollUpdateMessage } from '../features/pollManager.js'

/**
 * Handle messages.upsert event
 */
export async function onMessagesUpsert(sock, { messages, type }, io) {
  // Only handle real-time notifications (not history sync)
  if (type !== 'notify') return

  for (const msg of messages) {
    if (!msg.message) continue
    const msgType = getContentType(msg.message)

    // Skip pure protocol/key-distribution messages
    if (msgType === 'protocolMessage' || msgType === 'senderKeyDistributionMessage') continue

    // pollUpdateMessage = a vote arrived (group polls come this way via upsert)
    if (msgType === 'pollUpdateMessage') {
      const result = await handlePollUpdateMessage(sock, msg)
      if (result) {
        io?.emit('poll_result', result)
        console.log('Poll result (upsert):', result.question, result.results)
      }
      continue  // don't show in live messages feed
    }

    const jid = msg.key.remoteJid
    const isGroup = jid?.endsWith('@g.us')
    const sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : msg.key.remoteJid
    const text = extractText(msg)
    const typeLabel = getMessageTypeLabel(msg)

    // Emit to web UI
    const uiMsg = {
      id: msg.key.id,
      jid,
      sender,
      fromMe: msg.key.fromMe,
      pushName: msg.pushName,
      type: typeLabel,
      text,
      timestamp: msg.messageTimestamp,
      isGroup,
    }

    // Download media for display in UI (small images only)
    if (['imageMessage', 'stickerMessage'].includes(msgType)) {
      try {
        const media = await downloadMedia(sock, msg)
        if (media) {
          uiMsg.mediaDataUrl = bufferToDataUrl(media.buffer, media.mimetype)
          uiMsg.mimetype = media.mimetype
        }
      } catch {}
    }

    io?.emit('message', uiMsg)

    // ── Auto-reply / command handling (only for messages not from us) ────────
    if (!msg.key.fromMe) {
      await handleCommand(sock, msg, io)
    }
  }
}

/**
 * Handle messages.update event (status, poll votes for private chats)
 */
export async function onMessagesUpdate(sock, updates, io) {
  // messages.update path — works for private chat polls
  const pollResult = handlePollUpdate(updates, sock.user?.id)
  if (pollResult) {
    io?.emit('poll_result', pollResult)
    console.log('Poll result (update):', pollResult.question, pollResult.results)
  }

  for (const update of updates) {
    io?.emit('message_update', {
      id: update.key?.id,
      jid: update.key?.remoteJid,
      status: update.update?.status,
    })
  }
}
