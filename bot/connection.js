import makeWASocket, {
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
  fetchLatestWaWebVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} from '@kelvdra/baileys'
import pino from 'pino'

const logger = pino({ level: 'silent' })

export const store = makeInMemoryStore({ logger })

// Try to restore previous store
try { store.readFromFile('./baileys_store.json') } catch {}

// Save store every 10s
setInterval(() => {
  try { store.writeToFile('./baileys_store.json') } catch {}
}, 10_000)

let sock = null
let io = null   // Socket.IO instance, injected after server starts
let reconnectTimer = null

export function setIO(socketIO) {
  io = socketIO
}

export function getSock() {
  return sock
}

export async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info')
  const { version, isLatest } = await fetchLatestWaWebVersion({}).catch(() => ({ version: [2, 3000, 1023209645], isLatest: false }))

  console.log(`Using WA v${version.join('.')} — latest: ${isLatest}`)

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: true,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      const msg = await store.loadMessage(key.remoteJid, key.id)
      return msg?.message || undefined
    },
  })

  store.bind(sock.ev)

  // ── Connection updates ──────────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr, isNewLogin } = update

    if (qr) {
      // Convert QR string to data URL and emit to browser
      try {
        const QRCode = (await import('qrcode')).default
        const dataUrl = await QRCode.toDataURL(qr)
        io?.emit('qr', dataUrl)
        console.log('QR code sent to web UI')
      } catch (e) {
        console.error('QR encode error', e)
      }
    }

    if (connection === 'open') {
      console.log('Connected to WhatsApp ✓')
      io?.emit('connection', { status: 'open', user: sock.user })
    }

    if (connection === 'connecting') {
      io?.emit('connection', { status: 'connecting', user: null })
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode
      const reason = Object.keys(DisconnectReason).find(k => DisconnectReason[k] === statusCode) || statusCode
      console.log(`Connection closed. Reason: ${reason}`)
      io?.emit('connection', { status: 'close', reason, user: null })

      if (statusCode !== DisconnectReason.loggedOut) {
        const delay = 3000
        console.log(`Reconnecting in ${delay}ms...`)
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(connectToWhatsApp, delay)
      } else {
        console.log('Logged out. Please scan QR again.')
        // Delete auth to force fresh login
        try {
          const fs = (await import('fs')).default
          fs.rmSync('auth_info', { recursive: true, force: true })
        } catch {}
        connectToWhatsApp()
      }
    }
  })

  // ── Save credentials ────────────────────────────────────────────────────────
  sock.ev.on('creds.update', saveCreds)

  // ── Forward all events to web UI ────────────────────────────────────────────
  const eventsToForward = [
    'messages.upsert',
    'messages.update',
    'messages.delete',
    'messages.reaction',
    'message-receipt.update',
    'chats.upsert',
    'chats.update',
    'chats.delete',
    'contacts.upsert',
    'contacts.update',
    'presence.update',
    'groups.upsert',
    'groups.update',
    'group-participants.update',
    'group.join-request',
    'call',
    'labels.edit',
    'labels.association',
    'blocklist.set',
    'blocklist.update',
  ]

  for (const event of eventsToForward) {
    sock.ev.on(event, (data) => {
      try {
        io?.emit('wa_event', { event, data: JSON.parse(JSON.stringify(data, bufferReplacer)) })
      } catch {}
    })
  }

  return sock
}

// Safely serialize Buffers for JSON
function bufferReplacer(key, value) {
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return `<Buffer ${value.length}b>`
  }
  if (typeof value === 'bigint') return value.toString()
  return value
}
