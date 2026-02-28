import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getSock, store } from '../bot/connection.js'
import * as sendExamples from '../bot/features/sendExamples.js'
import * as groupManager from '../bot/features/groupManager.js'
import * as scheduler from '../bot/scheduler.js'
import { getPollHistory } from '../bot/features/pollManager.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function createWebServer() {
  const app = express()
  const httpServer = createServer(app)
  const io = new Server(httpServer, { cors: { origin: '*' } })

  app.use(express.json())
  app.use(express.static(join(__dirname, 'public')))

  // ── REST API ──────────────────────────────────────────────────────────────

  app.get('/api/status', (req, res) => {
    const sock = getSock()
    res.json({
      connected: !!sock?.user,
      user: sock?.user || null,
      state: store.state,
    })
  })

  app.get('/api/demo-types', (req, res) => {
    res.json(sendExamples.DEMO_TYPES)
  })

  app.get('/api/chats', (req, res) => {
    const chats = store.chats.all()

    const enriched = chats.slice(0, 100).map(chat => {
      // Try to grab the last stored message for this chat
      let lastMessage = null
      try {
        const msgs = store.messages[chat.id]
        if (msgs) {
          const all = msgs.array ?? msgs.toJSON?.() ?? Object.values(msgs)
          const last = all[all.length - 1]
          if (last?.message) {
            const m = last.message
            const fromMe = last.key?.fromMe
            // Extract text from whichever message type is present
            const text =
              m.conversation ||
              m.extendedTextMessage?.text ||
              m.imageMessage?.caption || (m.imageMessage ? '📷 Photo' : null) ||
              m.videoMessage?.caption || (m.videoMessage ? '🎥 Video' : null) ||
              m.audioMessage ? (m.audioMessage.ptt ? '🎤 Voice note' : '🎵 Audio') : null ||
              m.documentMessage ? `📄 ${m.documentMessage.fileName || 'Document'}` : null ||
              m.stickerMessage ? '🌟 Sticker' : null ||
              m.locationMessage ? '📍 Location' : null ||
              m.contactMessage ? '👤 Contact' : null ||
              m.pollCreationMessage ? `📊 Poll: ${m.pollCreationMessage.name}` : null ||
              m.pollCreationMessageV3 ? `📊 Poll: ${m.pollCreationMessageV3.name}` : null ||
              m.reactionMessage ? `${m.reactionMessage.text} Reaction` : null ||
              '📎 Message'
            lastMessage = { text, fromMe }
          }
        }
      } catch {}

      return { ...chat, lastMessage }
    })

    res.json(enriched)
  })

  app.get('/api/contacts', (req, res) => {
    res.json(Object.values(store.contacts).slice(0, 200))
  })

  app.get('/api/groups', async (req, res) => {
    try {
      const sock = getSock()
      if (!sock) return res.status(503).json({ error: 'Not connected' })
      const groups = await groupManager.getAllGroups(sock)
      res.json(groups)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/messages/:jid', async (req, res) => {
    try {
      const msgs = await store.loadMessages(req.params.jid, 50, undefined)
      res.json(msgs)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/send', async (req, res) => {
    const sock = getSock()
    if (!sock?.user) return res.status(503).json({ error: 'Not connected' })

    const { jid, type, payload = {} } = req.body
    if (!jid || !type) return res.status(400).json({ error: 'jid and type required' })

    try {
      let result

      switch (type) {
        case 'text':        result = await sendExamples.sendText(sock, jid, payload.text); break
        case 'image':       result = await sendExamples.sendImage(sock, jid, payload.url, payload.caption); break
        case 'video':       result = await sendExamples.sendVideo(sock, jid, payload.url, payload.caption); break
        case 'gif':         result = await sendExamples.sendGif(sock, jid, payload.url); break
        case 'audio':       result = await sendExamples.sendAudio(sock, jid, payload.url); break
        case 'voice':       result = await sendExamples.sendVoiceNote(sock, jid, payload.url); break
        case 'document':    result = await sendExamples.sendDocument(sock, jid, payload.url, payload.fileName); break
        case 'location':    result = await sendExamples.sendLocation(sock, jid, payload.lat, payload.lng); break
        case 'contact':     result = await sendExamples.sendContact(sock, jid); break
        case 'poll':        result = await sendExamples.sendPoll(sock, jid); break
        case 'multipoll':   result = await sendExamples.sendMultiPoll(sock, jid); break
        case 'buttons':     result = await sendExamples.sendButtons(sock, jid); break
        case 'list':        result = await sendExamples.sendList(sock, jid); break
        case 'cta_url':     result = await sendExamples.sendCTAUrl(sock, jid, payload.url); break
        case 'cta_call':    result = await sendExamples.sendCTACall(sock, jid, payload.phone); break
        case 'cta_copy':    result = await sendExamples.sendCTACopy(sock, jid); break
        case 'buttons_image': result = await sendExamples.sendButtonsWithImage(sock, jid); break
        case 'carousel':    result = await sendExamples.sendCarousel(sock, jid); break
        case 'album':       result = await sendExamples.sendAlbum(sock, jid); break
        case 'viewonce':    result = await sendExamples.sendViewOnce(sock, jid); break
        case 'disappear_on':  result = await sendExamples.enableDisappearing(sock, jid); break
        case 'disappear_off': result = await sendExamples.disableDisappearing(sock, jid); break
        case 'event':       result = await sendExamples.sendEvent(sock, jid); break
        default:
          return res.status(400).json({ error: `Unknown type: ${type}` })
      }

      res.json({ success: true, messageId: result?.key?.id })
    } catch (e) {
      console.error('Send error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  // ── Custom Interactive Messages ───────────────────────────────────────────
  app.post('/api/send-interactive', async (req, res) => {
    const sock = getSock()
    if (!sock?.user) return res.status(503).json({ error: 'Not connected' })

    const { jid, type, payload = {} } = req.body
    if (!jid || !type) return res.status(400).json({ error: 'jid and type required' })

    try {
      let result

      if (type === 'custom_buttons') {
        const { header, body, footer, buttons } = payload
        result = await sock.sendMessage(jid, {
          text: body,
          title: header || '',
          footer: footer || '',
          interactiveButtons: buttons.map(b => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: b.label, id: b.id }),
          })),
        })

      } else if (type === 'custom_list') {
        const { header, body, footer, buttonText, sections } = payload
        result = await sock.sendMessage(jid, {
          text: body,
          title: header || '',
          footer: footer || '',
          interactiveButtons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: buttonText || 'View Options',
              sections: sections.map(s => ({
                title: s.title,
                rows: s.rows.map(r => ({
                  title: r.title,
                  description: r.description || '',
                  id: r.rowId,
                })),
              })),
            }),
          }],
        })

      } else if (type === 'custom_poll') {
        const { question, options, selectableCount } = payload
        result = await sock.sendMessage(jid, {
          poll: {
            name: question,
            values: options,
            selectableCount: selectableCount ?? 1,
          },
        })

      } else if (type === 'custom_cta_url') {
        const { text, label, url } = payload
        result = await sock.sendMessage(jid, {
          text,
          title: label || 'Open Link',
          footer: '',
          interactiveButtons: [{
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
              display_text: label || 'Open Link',
              url,
              merchant_url: url,
            }),
          }],
        })

      } else if (type === 'custom_cta_call') {
        const { text, label, phone } = payload
        result = await sock.sendMessage(jid, {
          text,
          title: label || 'Call Now',
          footer: '',
          interactiveButtons: [{
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
              display_text: label || 'Call Now',
              phone_number: phone,
            }),
          }],
        })

      } else if (type === 'custom_cta_copy') {
        const { text, label, code } = payload
        result = await sock.sendMessage(jid, {
          text,
          title: label || 'Copy Code',
          footer: '',
          interactiveButtons: [{
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
              display_text: label || 'Copy Code',
              id: 'copy_code_001',
              copy_code: code,
            }),
          }],
        })

      } else if (type === 'custom_buttons_image') {
        const { imageUrl, caption, footer, buttons } = payload
        result = await sock.sendMessage(jid, {
          image: { url: imageUrl },
          caption: caption || '',
          footer: footer || '',
          interactiveButtons: buttons.map(b => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: b.label, id: b.id }),
          })),
        })

      } else if (type === 'custom_carousel') {
        const { body, cards } = payload
        result = await sock.sendMessage(jid, {
          carouselMessage: {
            caption: body || '',
            footer: '',
            cards: cards.map(card => ({
              headerTitle: card.title,
              imageUrl: card.imageUrl,
              bodyText: card.description,
              buttons: card.buttons.map(b => b.type === 'cta_url'
                ? { name: 'cta_url', params: { display_text: b.label, url: b.value, merchant_url: b.value } }
                : { name: 'quick_reply', params: { display_text: b.label, id: b.value } }
              ),
            })),
          },
        })

      } else {
        return res.status(400).json({ error: `Unknown interactive type: ${type}` })
      }

      res.json({ success: true, messageId: result?.key?.id })
    } catch (e) {
      console.error('Interactive send error:', e)
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/group/:jid/invite', async (req, res) => {
    try {
      const sock = getSock()
      if (!sock) return res.status(503).json({ error: 'Not connected' })
      const link = await groupManager.getInviteLink(sock, req.params.jid)
      res.json({ link })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/group/:jid/participants', async (req, res) => {
    try {
      const sock = getSock()
      if (!sock) return res.status(503).json({ error: 'Not connected' })
      const { action, participants } = req.body
      const result = await sock.groupParticipantsUpdate(req.params.jid, participants, action)
      res.json({ result })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/privacy', async (req, res) => {
    try {
      const sock = getSock()
      if (!sock) return res.status(503).json({ error: 'Not connected' })
      const settings = await sock.fetchPrivacySettings(true)
      res.json(settings)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/profile/status', async (req, res) => {
    try {
      const sock = getSock()
      if (!sock) return res.status(503).json({ error: 'Not connected' })
      await sock.updateProfileStatus(req.body.status)
      res.json({ success: true })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/poll-history', (req, res) => {
    res.json(getPollHistory())
  })

  // ── Scheduler Routes ──────────────────────────────────────────────────────
  app.get('/api/schedules', (req, res) => {
    try { res.json(scheduler.getAll()) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.post('/api/schedules', (req, res) => {
    try {
      const row = scheduler.create(req.body)
      res.json({ success: true, schedule: row })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.put('/api/schedules/:id', async (req, res) => {
    try {
      const { runNow, ...fields } = req.body
      if (runNow) {
        // Immediately fire
        const sched = scheduler.getAll().find(s => s.id === parseInt(req.params.id))
        if (!sched) return res.status(404).json({ error: 'Not found' })
        const sock = getSock()
        if (!sock?.user) return res.status(503).json({ error: 'Not connected' })
        const payload = JSON.parse(sched.payload)
        await scheduler.dispatchMessage(sock, sched.jid, sched.endpoint, sched.type, payload)
        res.json({ success: true })
      } else {
        const row = scheduler.update(parseInt(req.params.id), fields)
        res.json({ success: true, schedule: row })
      }
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  app.delete('/api/schedules/:id', (req, res) => {
    try { scheduler.remove(parseInt(req.params.id)); res.json({ success: true }) }
    catch (e) { res.status(500).json({ error: e.message }) }
  })

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log('Web UI connected:', socket.id)

    // Send current status immediately
    const sock = getSock()
    socket.emit('connection', {
      status: sock?.user ? 'open' : 'connecting',
      user: sock?.user || null,
    })

    socket.on('disconnect', () => {
      console.log('Web UI disconnected:', socket.id)
    })
  })

  return { app, httpServer, io }
}
