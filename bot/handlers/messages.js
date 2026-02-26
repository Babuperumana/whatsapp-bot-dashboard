import { getContentType } from '@kelvdra/baileys'
import { handleCommand } from './commands.js'
import { downloadMedia, bufferToDataUrl, extractText, getMessageTypeLabel } from '../features/mediaHandler.js'
import { handlePollUpdate } from '../features/pollManager.js'

/**
 * Handle messages.upsert event
 */
export async function onMessagesUpsert(sock, { messages, type }, io) {
  // Only handle real-time notifications (not history sync)
  if (type !== 'notify') return

  for (const msg of messages) {
    if (!msg.message) continue
    // Ignore protocol messages & our own sent messages (fromMe) for commands
    const msgType = getContentType(msg.message)
    if (msgType === 'protocolMessage' || msgType === 'senderKeyDistributionMessage') continue

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
      // Try command handler first
      const handled = await handleCommand(sock, msg, io)

      // If not a command, do echo-bot behaviour (optional — disabled by default)
      // Uncomment below to enable echo:
      // if (!handled && text) {
      //   await sock.sendMessage(jid, { text: `Echo: ${text}` })
      // }
    }
  }
}

/**
 * Handle messages.update event (status, poll votes, reactions)
 */
export async function onMessagesUpdate(sock, updates, io) {
  // Check for poll vote updates
  const pollResult = handlePollUpdate(updates, sock.user?.id)
  if (pollResult) {
    io?.emit('poll_result', pollResult)
    console.log('Poll result:', pollResult)
  }

  for (const update of updates) {
    io?.emit('message_update', {
      id: update.key?.id,
      jid: update.key?.remoteJid,
      status: update.update?.status,
    })
  }
}
