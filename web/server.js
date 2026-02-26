import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getSock, store } from '../bot/connection.js'
import * as sendExamples from '../bot/features/sendExamples.js'
import * as groupManager from '../bot/features/groupManager.js'

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
    res.json(chats.slice(0, 100))
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
