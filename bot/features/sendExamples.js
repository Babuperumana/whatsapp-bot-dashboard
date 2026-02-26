/**
 * sendExamples.js
 * Demonstrates every message type supported by @kelvdra/baileys
 */

// ── Text ────────────────────────────────────────────────────────────────────
export async function sendText(sock, jid, text = 'Hello from the bot! 👋') {
  return sock.sendMessage(jid, { text })
}

// ── Text with mention ────────────────────────────────────────────────────────
export async function sendMention(sock, jid, mentionJid) {
  const jidClean = mentionJid.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
  return sock.sendMessage(jid, {
    text: `Hey @${jidClean.split('@')[0]}! 👋`,
    mentions: [jidClean],
  })
}

// ── Image ───────────────────────────────────────────────────────────────────
export async function sendImage(sock, jid, url = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60', caption = 'Sample image 🖼️') {
  return sock.sendMessage(jid, { image: { url }, caption })
}

// ── Video ───────────────────────────────────────────────────────────────────
export async function sendVideo(sock, jid, url = 'https://www.w3schools.com/html/mov_bbb.mp4', caption = 'Sample video 🎬') {
  return sock.sendMessage(jid, { video: { url }, caption })
}

// ── GIF (video with gifPlayback) ────────────────────────────────────────────
export async function sendGif(sock, jid, url = 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.mp4') {
  return sock.sendMessage(jid, { video: { url }, gifPlayback: true, caption: 'Sample GIF 🎆' })
}

// ── Audio (regular) ─────────────────────────────────────────────────────────
export async function sendAudio(sock, jid, url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3') {
  return sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mp4' })
}

// ── Voice Note (ptt) ────────────────────────────────────────────────────────
// WhatsApp PTT requires Opus codec in OGG container — convert MP3 via ffmpeg
export async function sendVoiceNote(sock, jid) {
  const { default: axios } = await import('axios')
  const { execSync } = await import('child_process')
  const { writeFileSync, readFileSync, unlinkSync } = await import('fs')
  const { tmpdir } = await import('os')
  const { join } = await import('path')

  // Download a short MP3 sample
  const mp3Url = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
  const response = await axios.get(mp3Url, { responseType: 'arraybuffer', timeout: 15000 })

  const tmpIn = join(tmpdir(), `voice_in_${Date.now()}.mp3`)
  const tmpOut = join(tmpdir(), `voice_out_${Date.now()}.ogg`)

  try {
    writeFileSync(tmpIn, Buffer.from(response.data))
    // Convert to OGG/Opus (30 seconds max for demo) using ffmpeg
    execSync(`ffmpeg -y -i "${tmpIn}" -t 30 -c:a libopus -b:a 32k -ar 16000 -ac 1 "${tmpOut}"`, { stdio: 'pipe' })
    const audioBuffer = readFileSync(tmpOut)
    return sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true,
    })
  } finally {
    try { unlinkSync(tmpIn) } catch {}
    try { unlinkSync(tmpOut) } catch {}
  }
}

// ── Document ────────────────────────────────────────────────────────────────
export async function sendDocument(sock, jid, url = 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/PDF1', fileName = 'sample.pdf') {
  return sock.sendMessage(jid, {
    document: { url },
    mimetype: 'application/pdf',
    fileName,
    caption: 'Sample document 📄',
  })
}

// ── Location ────────────────────────────────────────────────────────────────
export async function sendLocation(sock, jid, lat = 37.7749, lng = -122.4194) {
  return sock.sendMessage(jid, {
    location: { degreesLatitude: lat, degreesLongitude: lng },
  })
}

// ── Contact ─────────────────────────────────────────────────────────────────
export async function sendContact(sock, jid) {
  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'FN:Sample Contact',
    'ORG:Acme Corp;',
    'TEL;type=CELL;type=VOICE;waid=14155552671:+1 (415) 555-2671',
    'END:VCARD',
  ].join('\n')

  return sock.sendMessage(jid, {
    contacts: {
      displayName: 'Sample Contact',
      contacts: [{ vcard }],
    },
  })
}

// ── Sticker (from URL image as buffer) ────────────────────────────────────────
export async function sendSticker(sock, jid) {
  // Use a small placeholder buffer (proper sticker would need a webp)
  // For demo purposes we re-send a static sticker that already exists in media
  return sock.sendMessage(jid, { text: '(Sticker demo: send a real .webp file via the chat commands)' })
}

// ── Poll ────────────────────────────────────────────────────────────────────
export async function sendPoll(sock, jid) {
  return sock.sendMessage(jid, {
    poll: {
      name: '🗳️ What is your favorite color?',
      values: ['Red 🔴', 'Green 🟢', 'Blue 🔵', 'Yellow 🟡'],
      selectableCount: 1,
    },
  })
}

// ── Multi-select Poll ───────────────────────────────────────────────────────
export async function sendMultiPoll(sock, jid) {
  return sock.sendMessage(jid, {
    poll: {
      name: '🍕 What toppings do you like?',
      values: ['Cheese 🧀', 'Pepperoni 🥩', 'Mushrooms 🍄', 'Olives 🫒'],
      selectableCount: 3,
    },
  })
}

// ── Reaction ────────────────────────────────────────────────────────────────
export async function sendReaction(sock, jid, key, emoji = '👍') {
  return sock.sendMessage(jid, { react: { text: emoji, key } })
}

// ── Remove Reaction ─────────────────────────────────────────────────────────
export async function removeReaction(sock, jid, key) {
  return sock.sendMessage(jid, { react: { text: '', key } })
}

// ── Interactive Buttons (quick_reply) ───────────────────────────────────────
export async function sendButtons(sock, jid) {
  return sock.sendMessage(jid, {
    text: 'Choose an option below 👇',
    title: 'Interactive Buttons',
    footer: 'Powered by Baileys',
    interactiveButtons: [
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: '✅ Option 1', id: 'btn_1' }),
      },
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: '🔁 Option 2', id: 'btn_2' }),
      },
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: '❌ Cancel', id: 'btn_cancel' }),
      },
    ],
  })
}

// ── Interactive List (single_select) ───────────────────────────────────────
export async function sendList(sock, jid) {
  return sock.sendMessage(jid, {
    text: 'Select an item from the list',
    title: 'Menu',
    footer: 'Bot Menu',
    interactiveButtons: [
      {
        name: 'single_select',
        buttonParamsJson: JSON.stringify({
          title: 'View Menu',
          sections: [
            {
              title: '🍔 Food',
              rows: [
                { title: 'Burger', description: 'Juicy beef burger', id: 'food_burger' },
                { title: 'Pizza', description: 'Margherita pizza', id: 'food_pizza' },
                { title: 'Salad', description: 'Fresh garden salad', id: 'food_salad' },
              ],
            },
            {
              title: '🥤 Drinks',
              rows: [
                { title: 'Coffee ☕', description: 'Hot black coffee', id: 'drink_coffee' },
                { title: 'Juice 🍹', description: 'Fresh orange juice', id: 'drink_juice' },
              ],
            },
          ],
        }),
      },
    ],
  })
}

// ── CTA URL Button ──────────────────────────────────────────────────────────
export async function sendCTAUrl(sock, jid, url = 'https://github.com') {
  return sock.sendMessage(jid, {
    text: 'Visit our website!',
    title: 'Click Below',
    footer: 'Link Preview',
    interactiveButtons: [
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({
          display_text: '🔗 Open Website',
          url,
          merchant_url: url,
        }),
      },
    ],
  })
}

// ── CTA Call Button ─────────────────────────────────────────────────────────
export async function sendCTACall(sock, jid, phoneNumber = '+1234567890') {
  return sock.sendMessage(jid, {
    text: 'Need help? Call us!',
    title: 'Contact Support',
    footer: 'Available 24/7',
    interactiveButtons: [
      {
        name: 'cta_call',
        buttonParamsJson: JSON.stringify({
          display_text: '📞 Call Now',
          phone_number: phoneNumber,
        }),
      },
    ],
  })
}

// ── CTA Copy Button ─────────────────────────────────────────────────────────
export async function sendCTACopy(sock, jid) {
  return sock.sendMessage(jid, {
    text: 'Here is your promo code:',
    title: 'Promo Code',
    interactiveButtons: [
      {
        name: 'cta_copy',
        buttonParamsJson: JSON.stringify({
          display_text: '📋 Copy Code',
          id: 'copy_code_001',
          copy_code: 'SAVE20OFF',
        }),
      },
    ],
  })
}

// ── Buttons with Image ──────────────────────────────────────────────────────
export async function sendButtonsWithImage(sock, jid) {
  return sock.sendMessage(jid, {
    image: { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60' },
    caption: 'Check out this product!',
    interactiveButtons: [
      {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: '🛒 Buy Now', id: 'buy' }),
      },
      {
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ display_text: '🔍 More Info', url: 'https://example.com' }),
      },
    ],
  })
}

// ── Carousel ────────────────────────────────────────────────────────────────
export async function sendCarousel(sock, jid) {
  return sock.sendMessage(jid, {
    carouselMessage: {
      caption: 'Check out our products!',
      footer: 'Swipe to see more',
      cards: [
        {
          headerTitle: 'Product 1',
          imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60',
          bodyText: 'Amazing product at a great price',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🛒 Buy', id: 'buy_1' } },
            { name: 'cta_url', params: { display_text: '🔗 Details', url: 'https://example.com/1' } },
          ],
        },
        {
          headerTitle: 'Product 2',
          imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60',
          bodyText: 'Another great product for you',
          buttons: [
            { name: 'quick_reply', params: { display_text: '🛒 Buy', id: 'buy_2' } },
            { name: 'cta_url', params: { display_text: '🔗 Details', url: 'https://example.com/2' } },
          ],
        },
        {
          headerTitle: 'Product 3',
          imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60',
          bodyText: 'Limited time offer!',
          buttons: [
            { name: 'quick_reply', params: { display_text: '⚡ Order Now', id: 'buy_3' } },
          ],
        },
      ],
    },
  })
}

// ── Album (multiple images) ─────────────────────────────────────────────────
export async function sendAlbum(sock, jid) {
  return sock.sendAlbumMessage(jid, [
    { image: { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60' }, caption: 'Photo 1' },
    { image: { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60' }, caption: 'Photo 2' },
    { image: { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60' }, caption: 'Photo 3' },
  ], { delay: 500 })
}

// ── Disappearing Messages Toggle ────────────────────────────────────────────
export async function enableDisappearing(sock, jid, seconds = 604800) {
  return sock.sendMessage(jid, { disappearingMessagesInChat: seconds })
}

export async function disableDisappearing(sock, jid) {
  return sock.sendMessage(jid, { disappearingMessagesInChat: false })
}

// ── View Once ───────────────────────────────────────────────────────────────
// Uses a minimal inline JPEG (1x1 red pixel) — no external URL needed
export async function sendViewOnce(sock, jid) {
  // Minimal valid JPEG: 1×1 red pixel, ~631 bytes
  const jpegBase64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
    'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgN' +
    'DRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
    'MjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA' +
    'AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA' +
    '/9oADAMBAAIRAxEAPwCwABmX/9k='
  const imageBuffer = Buffer.from(jpegBase64, 'base64')
  return sock.sendMessage(jid, {
    image: imageBuffer,
    mimetype: 'image/jpeg',
    viewOnce: true,
  })
}

// ── Forward a message ───────────────────────────────────────────────────────
export async function forwardMessage(sock, jid, msg) {
  return sock.sendMessage(jid, { forward: msg, force: true })
}

// ── Delete a message ────────────────────────────────────────────────────────
export async function deleteMessage(sock, jid, msgKey) {
  return sock.sendMessage(jid, { delete: msgKey })
}

// ── Edit a message ──────────────────────────────────────────────────────────
export async function editMessage(sock, jid, msgKey, newText) {
  return sock.sendMessage(jid, { text: newText, edit: msgKey })
}

// ── Pin a message ───────────────────────────────────────────────────────────
export async function pinMessage(sock, jid, msgKey, durationSecs = 86400) {
  return sock.sendMessage(jid, { pin: { type: 1, time: durationSecs, key: msgKey } })
}

// ── Unpin a message ──────────────────────────────────────────────────────────
export async function unpinMessage(sock, jid, msgKey) {
  return sock.sendMessage(jid, { pin: { type: 0, time: 0, key: msgKey } })
}

// ── Status/Story broadcast ──────────────────────────────────────────────────
export async function sendStatus(sock, statusJidList = []) {
  return sock.sendMessage('status@broadcast', {
    image: { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60' },
    caption: '🤖 Bot status update!',
  }, {
    backgroundColor: '#25D366',
    broadcast: true,
    statusJidList,
  })
}

// ── Event message ───────────────────────────────────────────────────────────
export async function sendEvent(sock, jid) {
  const startDate = new Date(Date.now() + 86400 * 1000) // tomorrow
  const endDate = new Date(startDate.getTime() + 2 * 3600 * 1000) // +2 hours
  return sock.sendMessage(jid, {
    event: {
      name: '🎉 Bot Community Meetup',
      description: 'Join us for our monthly WhatsApp bot community event!',
      location: { degreesLatitude: 37.7749, degreesLongitude: -122.4194 },
      startDate,
      endDate,
      extraGuestsAllowed: true,
    },
  })
}

// ── Payment request ─────────────────────────────────────────────────────────
export async function sendPaymentRequest(sock, jid, from) {
  return sock.sendMessage(jid, {
    requestPayment: {
      currency: 'USD',
      amount: '10.00',
      from,
      note: 'Payment for bot services',
    },
  })
}

// Helper: all demo types list (for web UI dropdown)
export const DEMO_TYPES = [
  { id: 'text', label: '💬 Text Message' },
  { id: 'image', label: '🖼️ Image' },
  { id: 'video', label: '🎬 Video' },
  { id: 'gif', label: '🎆 GIF' },
  { id: 'audio', label: '🎵 Audio' },
  { id: 'voice', label: '🎙️ Voice Note' },
  { id: 'document', label: '📄 Document' },
  { id: 'location', label: '📍 Location' },
  { id: 'contact', label: '👤 Contact Card' },
  { id: 'poll', label: '🗳️ Poll (single choice)' },
  { id: 'multipoll', label: '🗳️ Poll (multi choice)' },
  { id: 'buttons', label: '🔘 Quick Reply Buttons' },
  { id: 'list', label: '📋 Interactive List' },
  { id: 'cta_url', label: '🔗 CTA URL Button' },
  { id: 'cta_call', label: '📞 CTA Call Button' },
  { id: 'cta_copy', label: '📋 CTA Copy Button' },
  { id: 'buttons_image', label: '🖼️ Buttons with Image' },
  { id: 'carousel', label: '🎠 Carousel' },
  { id: 'album', label: '📸 Album (multi-image)' },
  { id: 'viewonce', label: '👁️ View Once Image' },
  { id: 'disappear_on', label: '⏳ Enable Disappearing' },
  { id: 'disappear_off', label: '🚫 Disable Disappearing' },
  { id: 'event', label: '📅 Event Message' },
]
