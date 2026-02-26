import { downloadMediaMessage, getContentType } from '@kelvdra/baileys'

/**
 * Download media from a message and return as Buffer + mime info
 */
export async function downloadMedia(sock, message) {
  const msgType = getContentType(message.message)
  if (!msgType) return null

  const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
  if (!mediaTypes.includes(msgType)) return null

  try {
    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      { logger: { info: () => {}, error: console.error, warn: () => {}, debug: () => {}, child: () => ({ info: () => {}, error: () => {}, warn: () => {}, debug: () => {} }) }, reuploadRequest: sock.updateMediaMessage }
    )

    const mediaMsg = message.message[msgType]
    return {
      buffer,
      mimetype: mediaMsg?.mimetype || 'application/octet-stream',
      fileName: mediaMsg?.fileName,
      type: msgType.replace('Message', ''),
      caption: mediaMsg?.caption,
    }
  } catch (e) {
    console.error('Media download error:', e.message)
    return null
  }
}

/**
 * Convert buffer to base64 data URL for browser display
 */
export function bufferToDataUrl(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`
}

/**
 * Extract text content from any message type
 */
export function extractText(message) {
  const m = message?.message
  if (!m) return ''

  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    ''
  )
}

/**
 * Get message type label for display
 */
export function getMessageTypeLabel(message) {
  const type = getContentType(message?.message)
  const labels = {
    conversation: '💬 Text',
    extendedTextMessage: '💬 Text',
    imageMessage: '🖼️ Image',
    videoMessage: '🎬 Video',
    audioMessage: '🎵 Audio',
    documentMessage: '📄 Document',
    stickerMessage: '🎭 Sticker',
    locationMessage: '📍 Location',
    contactMessage: '👤 Contact',
    contactsArrayMessage: '👥 Contacts',
    pollCreationMessage: '🗳️ Poll',
    pollCreationMessageV2: '🗳️ Poll',
    pollCreationMessageV3: '🗳️ Poll',
    reactionMessage: '😀 Reaction',
    buttonsMessage: '🔘 Buttons',
    listMessage: '📋 List',
    templateMessage: '📝 Template',
    interactiveMessage: '🎛️ Interactive',
    protocolMessage: '🔧 Protocol',
    groupInviteMessage: '👥 Group Invite',
    viewOnceMessage: '👁️ View Once',
    liveLocationMessage: '📡 Live Location',
    orderMessage: '🛍️ Order',
    paymentInviteMessage: '💳 Payment',
    eventMessage: '📅 Event',
    carouselMessage: '🎠 Carousel',
  }
  return labels[type] || `📦 ${type || 'Unknown'}`
}
