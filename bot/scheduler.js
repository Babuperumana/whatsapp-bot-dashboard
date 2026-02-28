import { createRequire } from 'module'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')
const cron = require('node-cron')

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'schedules.db')

let db
let _getSock
let _io

// ── DB init ──────────────────────────────────────────────────────────────────
function openDb() {
  db = new Database(DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      label          TEXT,
      jid            TEXT    NOT NULL,
      endpoint       TEXT    NOT NULL,
      type           TEXT    NOT NULL,
      payload        TEXT    NOT NULL DEFAULT '{}',
      schedule_type  TEXT    NOT NULL,
      schedule_value TEXT    NOT NULL,
      enabled        INTEGER NOT NULL DEFAULT 1,
      next_run       INTEGER,
      last_run       INTEGER,
      created_at     INTEGER NOT NULL
    )
  `)
}

// ── computeNextRun ───────────────────────────────────────────────────────────
export function computeNextRun(scheduleType, scheduleValue) {
  const now = Date.now()
  if (scheduleType === 'once') {
    return new Date(scheduleValue).getTime()
  }
  if (scheduleType === 'daily') {
    // scheduleValue = "HH:MM"
    const [h, m] = scheduleValue.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    if (d.getTime() <= now) d.setDate(d.getDate() + 1)
    return d.getTime()
  }
  if (scheduleType === 'weekly') {
    // scheduleValue = "MON:HH:MM"
    const [dayStr, timeStr] = scheduleValue.split(':')
    const [h, m] = timeStr.split(':').map(Number)
    const days = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
    const targetDay = days[dayStr.toUpperCase()] ?? 1
    const d = new Date()
    d.setHours(h, m, 0, 0)
    const diff = (targetDay - d.getDay() + 7) % 7 || (d.getTime() <= now ? 7 : 0)
    d.setDate(d.getDate() + diff)
    return d.getTime()
  }
  if (scheduleType === 'interval') {
    // scheduleValue = number of seconds
    return now + parseInt(scheduleValue) * 1000
  }
  return now
}

// ── CRUD ─────────────────────────────────────────────────────────────────────
export function getAll() {
  return db.prepare('SELECT * FROM schedules ORDER BY created_at DESC').all()
}

export function create(data) {
  const next_run = computeNextRun(data.schedule_type, data.schedule_value)
  const info = db.prepare(`
    INSERT INTO schedules (label, jid, endpoint, type, payload, schedule_type, schedule_value, enabled, next_run, created_at)
    VALUES (@label, @jid, @endpoint, @type, @payload, @schedule_type, @schedule_value, 1, @next_run, @created_at)
  `).run({
    label: data.label || '',
    jid: data.jid,
    endpoint: data.endpoint,
    type: data.type,
    payload: typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload),
    schedule_type: data.schedule_type,
    schedule_value: data.schedule_value,
    next_run,
    created_at: Date.now(),
  })
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(info.lastInsertRowid)
}

export function update(id, fields) {
  // If schedule timing changed, recompute next_run
  const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id)
  if (!existing) return null

  if (fields.runNow) {
    // Trigger immediate fire — set next_run to past
    db.prepare('UPDATE schedules SET next_run = 0 WHERE id = ?').run(id)
    return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id)
  }

  const newType  = fields.schedule_type  ?? existing.schedule_type
  const newValue = fields.schedule_value ?? existing.schedule_value
  const recompute = fields.schedule_type || fields.schedule_value
  const next_run = recompute ? computeNextRun(newType, newValue) : existing.next_run

  const cols = { ...fields }
  delete cols.runNow
  if (recompute) cols.next_run = next_run

  const sets = Object.keys(cols).map(k => `${k} = @${k}`).join(', ')
  if (!sets) return existing
  db.prepare(`UPDATE schedules SET ${sets} WHERE id = @id`).run({ ...cols, id })
  return db.prepare('SELECT * FROM schedules WHERE id = ?').get(id)
}

export function remove(id) {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
}

// ── Dispatch (shared with server.js) ─────────────────────────────────────────
export async function dispatchMessage(sock, jid, endpoint, type, payload) {
  if (endpoint === 'send') {
    const p = payload
    switch (type) {
      case 'text':          return sock.sendMessage(jid, { text: p.text || 'Hello!' })
      case 'image':         return sock.sendMessage(jid, { image: { url: p.url }, caption: p.caption || '' })
      case 'video':         return sock.sendMessage(jid, { video: { url: p.url }, caption: p.caption || '' })
      case 'gif':           return sock.sendMessage(jid, { video: { url: p.url }, gifPlayback: true })
      case 'audio':         return sock.sendMessage(jid, { audio: { url: p.url }, mimetype: 'audio/mp4' })
      case 'document':      return sock.sendMessage(jid, { document: { url: p.url }, fileName: p.fileName || 'file.pdf', mimetype: 'application/pdf' })
      case 'location':      return sock.sendMessage(jid, { location: { degreesLatitude: p.lat, degreesLongitude: p.lng } })
      case 'disappear_on':  return sock.sendMessage(jid, { disappearingMessagesInChat: 604800 })
      case 'disappear_off': return sock.sendMessage(jid, { disappearingMessagesInChat: 0 })
      default:              throw new Error(`Unsupported send type for scheduler: ${type}`)
    }
  }

  if (endpoint === 'send-interactive') {
    switch (type) {
      case 'custom_buttons':
        return sock.sendMessage(jid, {
          text: payload.body, title: payload.header || '', footer: payload.footer || '',
          interactiveButtons: payload.buttons.map(b => ({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({ display_text: b.label, id: b.id }),
          })),
        })
      case 'custom_list':
        return sock.sendMessage(jid, {
          text: payload.body, title: payload.header || '', footer: payload.footer || '',
          interactiveButtons: [{
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
              title: payload.buttonText || 'View Options',
              sections: payload.sections.map(s => ({
                title: s.title,
                rows: s.rows.map(r => ({ title: r.title, description: r.description || '', id: r.rowId })),
              })),
            }),
          }],
        })
      case 'custom_poll':
        return sock.sendMessage(jid, {
          poll: { name: payload.question, values: payload.options, selectableCount: payload.selectableCount ?? 1 },
        })
      case 'custom_cta_url':
        return sock.sendMessage(jid, {
          text: payload.text, title: payload.label || '', footer: '',
          interactiveButtons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: payload.label || 'Open', url: payload.url, merchant_url: payload.url }) }],
        })
      case 'custom_cta_call':
        return sock.sendMessage(jid, {
          text: payload.text, title: payload.label || '', footer: '',
          interactiveButtons: [{ name: 'cta_call', buttonParamsJson: JSON.stringify({ display_text: payload.label || 'Call', phone_number: payload.phone }) }],
        })
      case 'custom_cta_copy':
        return sock.sendMessage(jid, {
          text: payload.text, title: payload.label || '', footer: '',
          interactiveButtons: [{ name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: payload.label || 'Copy', id: 'copy_001', copy_code: payload.code }) }],
        })
      case 'custom_buttons_image':
        return sock.sendMessage(jid, {
          image: { url: payload.imageUrl }, caption: payload.caption || '', footer: payload.footer || '',
          interactiveButtons: payload.buttons.map(b => ({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: b.label, id: b.id }) })),
        })
      case 'custom_carousel':
        return sock.sendMessage(jid, {
          carouselMessage: {
            caption: payload.body || '', footer: '',
            cards: payload.cards.map(card => ({
              headerTitle: card.title, imageUrl: card.imageUrl, bodyText: card.description,
              buttons: card.buttons.map(b => b.type === 'cta_url'
                ? { name: 'cta_url', params: { display_text: b.label, url: b.value, merchant_url: b.value } }
                : { name: 'quick_reply', params: { display_text: b.label, id: b.value } }
              ),
            })),
          },
        })
      default:
        throw new Error(`Unsupported interactive type for scheduler: ${type}`)
    }
  }

  throw new Error(`Unknown endpoint: ${endpoint}`)
}

// ── Cron tick ─────────────────────────────────────────────────────────────────
async function tick() {
  const now = Date.now()
  const due = db.prepare('SELECT * FROM schedules WHERE enabled = 1 AND next_run <= ?').all(now)
  for (const sched of due) {
    try {
      const sock = _getSock()
      if (!sock?.user) continue
      const payload = JSON.parse(sched.payload)
      await dispatchMessage(sock, sched.jid, sched.endpoint, sched.type, payload)
      const last_run = Date.now()

      if (sched.schedule_type === 'once') {
        db.prepare('UPDATE schedules SET enabled = 0, last_run = ? WHERE id = ?').run(last_run, sched.id)
      } else {
        const next_run = computeNextRun(sched.schedule_type, sched.schedule_value)
        db.prepare('UPDATE schedules SET last_run = ?, next_run = ? WHERE id = ?').run(last_run, next_run, sched.id)
      }

      _io?.emit('schedule_fired', { id: sched.id, label: sched.label, jid: sched.jid, type: sched.type, success: true })
      console.log(`⏰ Scheduler: fired "${sched.label || sched.type}" → ${sched.jid}`)
    } catch (e) {
      console.error(`⏰ Scheduler error for id=${sched.id}:`, e.message)
      _io?.emit('schedule_fired', { id: sched.id, label: sched.label, success: false, error: e.message })
    }
  }
}

// ── init ──────────────────────────────────────────────────────────────────────
export function initScheduler(getSockFn, io) {
  _getSock = getSockFn
  _io = io
  openDb()
  // Run every minute
  cron.schedule('* * * * *', tick)
  // Also run immediately on startup to catch any missed schedules
  setTimeout(tick, 3000)
  console.log('⏰ Scheduler started')
}
