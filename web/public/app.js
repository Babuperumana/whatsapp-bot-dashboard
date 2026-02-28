/* ── Socket.IO connection ─────────────────────────────────────────────────── */
const socket = io()

/* ── Tab Navigation ──────────────────────────────────────────────────────── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active')

    // Lazy load data
    if (btn.dataset.tab === 'chats') loadChats()
    if (btn.dataset.tab === 'groups') loadGroups()
    if (btn.dataset.tab === 'privacy') loadPrivacy()
    if (btn.dataset.tab === 'send') loadDemoTypes()
    if (btn.dataset.tab === 'scheduler') { scUpdateTypeList(); scUpdateScheduleFields(); loadScheduler() }
  })
})

/* ── Status helpers ──────────────────────────────────────────────────────── */
function setStatus(status, user) {
  const dot = document.getElementById('statusDot')
  const txt = document.getElementById('statusText')
  dot.className = 'status-dot ' + status

  if (status === 'open') {
    txt.textContent = user?.name || 'Connected'
    showConnected(user)
  } else if (status === 'connecting') {
    txt.textContent = 'Connecting…'
    showQRPlaceholder()
  } else {
    txt.textContent = 'Disconnected'
    showQRPlaceholder()
  }
}

function showQRPlaceholder() {
  document.getElementById('qrPlaceholder').style.display = 'flex'
  document.getElementById('qrImg').classList.remove('visible')
  document.getElementById('connectedBox').classList.remove('visible')
}

function showQR(dataUrl) {
  document.getElementById('qrPlaceholder').style.display = 'none'
  const img = document.getElementById('qrImg')
  img.src = dataUrl
  img.classList.add('visible')
  document.getElementById('connectedBox').classList.remove('visible')
}

function showConnected(user) {
  document.getElementById('qrPlaceholder').style.display = 'none'
  document.getElementById('qrImg').classList.remove('visible')
  const box = document.getElementById('connectedBox')
  box.classList.add('visible')
  document.getElementById('connectedName').textContent = user?.name || 'Connected'
  document.getElementById('connectedJid').textContent = user?.id || ''
  updateConnectionInfo(user)
  refreshStats()
}

function updateConnectionInfo(user) {
  const el = document.getElementById('connectionInfo')
  if (!user) { el.innerHTML = '<div style="color:var(--text2)">Not connected.</div>'; return }
  el.innerHTML = `
    <div><strong>Name:</strong> ${escHtml(user.name || 'N/A')}</div>
    <div><strong>JID:</strong> <code style="color:var(--green)">${escHtml(user.id || '')}</code></div>
    <div><strong>Phone:</strong> ${escHtml(user.id?.split('@')[0] || '')}</div>
    <div><strong>Platform:</strong> ${escHtml(user.platform || 'web')}</div>
  `
}

async function refreshStats() {
  try {
    const [chatsR, contactsR] = await Promise.all([
      fetch('/api/chats').then(r => r.json()),
      fetch('/api/contacts').then(r => r.json()),
    ])
    document.getElementById('statChats').textContent = chatsR.length || 0
    document.getElementById('statContacts').textContent = contactsR.length || 0
  } catch {}
}

/* ── Socket events ───────────────────────────────────────────────────────── */
socket.on('connection', ({ status, user }) => {
  setStatus(status, user)
  addLog('connection', `connection.update`, { status, user: user?.id })
})

socket.on('qr', (dataUrl) => {
  showQR(dataUrl)
  addLog('connection', 'qr', 'New QR code received')
})

socket.on('message', (msg) => {
  addLiveMessage(msg)
  incrementStat('statMessages')
  addLog('message', 'messages.upsert', msg)
})

socket.on('message_update', (upd) => {
  addLog('default', 'messages.update', upd)
})

socket.on('poll_result', (result) => {
  showPollResult(result)
  addLog('default', 'poll_result', result)
})

socket.on('presence', (data) => {
  addLog('default', 'presence.update', data)
})

socket.on('call', (call) => {
  addLog('call', 'call', call)
  showToast(`📞 ${call.isVideo ? 'Video' : 'Audio'} call ${call.status} from ${call.from}`, 'error')
})

socket.on('wa_event', ({ event, data }) => {
  addLog('default', event, data)
})

/* ── Live Messages ───────────────────────────────────────────────────────── */
function addLiveMessage(msg) {
  const area = document.getElementById('liveMessages')
  // Remove placeholder
  const placeholder = area.querySelector('[data-placeholder]')
  if (placeholder) placeholder.remove()

  const div = document.createElement('div')
  div.className = `message-bubble ${msg.fromMe ? 'outgoing' : 'incoming'}`

  const sender = msg.fromMe ? '🤖 Bot' : (msg.pushName || msg.sender?.split('@')[0] || 'Unknown')
  const time = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleTimeString() : ''
  const chatId = msg.jid?.split('@')[0] || ''

  div.innerHTML = `
    <div class="msg-sender">${escHtml(sender)} ${msg.isGroup ? `<span class="badge">Group ${chatId}</span>` : ''}</div>
    <span class="msg-type-badge">${escHtml(msg.type)}</span>
    ${msg.text ? `<div style="margin-top:4px">${escHtml(msg.text)}</div>` : ''}
    ${msg.mediaDataUrl ? `<img class="msg-media" src="${msg.mediaDataUrl}" alt="media">` : ''}
    <div class="msg-meta">${time}</div>
  `
  area.appendChild(div)
  area.scrollTop = area.scrollHeight
  if (area.children.length > 100) area.removeChild(area.firstChild)
}

/* ── Poll Results ────────────────────────────────────────────────────────── */
function renderPollCard(result) {
  const total = result.results.reduce((s, o) => s + o.count, 0)
  const time = result.timestamp ? new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  return `
    <div style="margin-bottom:16px;padding:12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">
      <div style="font-weight:600;margin-bottom:2px">${escHtml(result.question || 'Poll')}</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:10px">${total} vote${total !== 1 ? 's' : ''} · ${escHtml(result.jid?.split('@')[0] || '')} ${time ? '· ' + time : ''}</div>
      ${result.results.map(opt => {
        const pct = total > 0 ? Math.round((opt.count / total) * 100) : 0
        return `
          <div class="poll-option">
            <div class="poll-label">
              <span>${escHtml(opt.option)}</span>
              <span>${opt.count} (${pct}%)</span>
            </div>
            <div class="poll-bar-wrap"><div class="poll-bar" style="width:${pct}%"></div></div>
          </div>`
      }).join('')}
    </div>`
}

function showPollResult(result) {
  // Live section — show latest vote update
  const el = document.getElementById('pollResults')
  el.innerHTML = `<div style="font-size:11px;color:var(--green);font-weight:600;margin-bottom:8px">⚡ Live Update</div>` + renderPollCard(result)
  // Also refresh history so it includes this result
  loadPollHistory()
}

async function loadPollHistory() {
  const el = document.getElementById('pollHistory')
  try {
    const history = await fetch('/api/poll-history').then(r => r.json())
    if (!history.length) {
      el.innerHTML = '<div style="color:var(--text2);font-size:12px">No poll history yet — votes will appear here.</div>'
      return
    }
    el.innerHTML = `
      <div style="font-size:11px;color:var(--text2);font-weight:600;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">History (${history.length} poll${history.length !== 1 ? 's' : ''})</div>
      ${history.map(r => renderPollCard(r)).join('')}`
  } catch {}
}

/* ── Stats counter ───────────────────────────────────────────────────────── */
function incrementStat(id) {
  const el = document.getElementById(id)
  if (el) el.textContent = (parseInt(el.textContent) || 0) + 1
}

/* ── Chats Tab ───────────────────────────────────────────────────────────── */
async function loadChats() {
  const el = document.getElementById('chatList')
  el.innerHTML = '<div style="color:var(--text2)">Loading…</div>'
  try {
    const chats = await fetch('/api/chats').then(r => r.json())

    // Keep only real private chats (@s.whatsapp.net) and group chats (@g.us)
    // that have an actual conversation timestamp (i.e. real chat history)
    const real = chats.filter(c => {
      const id = c.id || ''
      const isPrivate = id.endsWith('@s.whatsapp.net')
      const isGroup   = id.endsWith('@g.us')
      if (!isPrivate && !isGroup) return false          // skip @lid, @newsletter, etc.
      if (id === '0@s.whatsapp.net') return false       // skip WhatsApp system account
      if (!c.conversationTimestamp) return false        // skip entries with no message history
      return true
    })

    // Sort newest first
    real.sort((a, b) => (b.conversationTimestamp || 0) - (a.conversationTimestamp || 0))

    if (!real.length) { el.innerHTML = '<div style="color:var(--text2)">No chats found.</div>'; return }

    el.innerHTML = real.map(c => {
      const isGroup = c.id.endsWith('@g.us')
      const icon = isGroup ? '👥' : '👤'
      const number = c.id.split('@')[0]
      const name = c.name || (isGroup ? `Group ${number}` : number)
      const date = new Date(c.conversationTimestamp * 1000)
      const now = new Date()
      const timeStr = date.toDateString() === now.toDateString()
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { day: 'numeric', month: 'short' })
      const previewText = c.lastMessage
        ? (c.lastMessage.fromMe ? '🤖 ' : '') + c.lastMessage.text
        : (isGroup ? c.id : '+' + number)
      return `
        <div class="chat-item" onclick="selectChat('${escAttr(c.id)}','${escAttr(name)}')">
          <div class="chat-avatar">${icon}</div>
          <div class="chat-info">
            <div class="chat-name">${escHtml(name)}</div>
            <div class="chat-preview">${escHtml(previewText)}</div>
          </div>
          <div class="chat-time">${escHtml(timeStr)}</div>
        </div>
      `
    }).join('')
    document.getElementById('statChats').textContent = real.length
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red)">${escHtml(e.message)}</div>`
  }
}

function selectChat(jid, name) {
  document.getElementById('sendJid').value = jid
  document.getElementById('demoJid').value = jid
  showToast(`Selected: ${name}`, 'success')
}

async function sendQuickText() {
  const jid = normalizeJid(document.getElementById('sendJid').value)
  const text = document.getElementById('sendMsg').value.trim()
  if (!jid || !text) { showToast('Enter JID and message', 'error'); return }
  await apiSend(jid, 'text', { text })
  document.getElementById('sendMsg').value = ''
}

/* ── Send Demo Tab ───────────────────────────────────────────────────────── */
async function loadDemoTypes() {
  const sel = document.getElementById('demoType')
  if (sel.options.length > 1) return  // already loaded
  try {
    const types = await fetch('/api/demo-types').then(r => r.json())
    sel.innerHTML = types.map(t => `<option value="${escAttr(t.id)}">${escHtml(t.label)}</option>`).join('')
    sel.addEventListener('change', updateExtraFields)
    updateExtraFields()

    // Gallery
    const gallery = document.getElementById('typeGallery')
    gallery.innerHTML = types.map(t => `
      <div class="stat-card" style="cursor:pointer;text-align:left" onclick="quickDemo('${escAttr(t.id)}')">
        <div style="font-size:20px;margin-bottom:6px">${t.label.split(' ')[0]}</div>
        <div style="font-size:12px;font-weight:600">${escHtml(t.label.replace(/^[^ ]+ /, ''))}</div>
        <div style="margin-top:8px">
          <span class="badge">!${escHtml(typeToCommand(t.id))}</span>
        </div>
      </div>
    `).join('')
  } catch (e) {
    console.error(e)
  }

  // Commands reference
  document.getElementById('commandsRef').innerHTML = commandsText.split('\n').map(l =>
    l.startsWith('!') ? `<div><span style="color:var(--green)">${escHtml(l)}</span></div>` :
    l.startsWith('*') ? `<div style="color:var(--blue);font-weight:bold">${escHtml(l.replace(/\*/g,''))}</div>` :
    `<div style="color:var(--text2)">${escHtml(l)}</div>`
  ).join('')
}

const commandsText = `*📨 Basic*
!ping — pong
!echo <text> — echo
!mention <num> — mention
*📎 Media*
!image !video !gif !audio
!voice !doc !viewonce !album
*📍 Content*
!location !contact !event
*🗳️ Polls*
!poll — single choice
!multipoll — multi choice
*🔘 Interactive*
!buttons !list !urlbtn
!callbtn !copybtn !carousel
!imgbtn
*💬 Actions*
!react !unreact !delete
!edit <text> !pin !unpin
!forward
*⚙️ Settings*
!disappear on/off !read
!typing !privacy !status
*👥 Groups*
!groupinfo !invite !announce
!lock !promote !kick`

function typeToCommand(type) {
  const map = {
    text: 'ping', image: 'image', video: 'video', gif: 'gif',
    audio: 'audio', voice: 'voice', document: 'doc', location: 'location',
    contact: 'contact', poll: 'poll', multipoll: 'multipoll',
    buttons: 'buttons', list: 'list', cta_url: 'urlbtn',
    cta_call: 'callbtn', cta_copy: 'copybtn', buttons_image: 'imgbtn',
    carousel: 'carousel', album: 'album', viewonce: 'viewonce',
    disappear_on: 'disappear on', disappear_off: 'disappear off',
    event: 'event',
  }
  return map[type] || type
}

function updateExtraFields() {
  const type = document.getElementById('demoType').value
  const container = document.getElementById('extraFields')
  const extras = {
    text: `<div class="form-group"><label>Text</label><input type="text" id="ef_text" value="Hello from the web UI! 👋"></div>`,
    image: `<div class="form-group"><label>Image URL</label><input type="text" id="ef_url" value="https://picsum.photos/800/600"><label>Caption</label><input type="text" id="ef_caption" value="Sample image"></div>`,
    video: `<div class="form-group"><label>Video URL</label><input type="text" id="ef_url" value="https://www.w3schools.com/html/mov_bbb.mp4"></div>`,
    cta_url: `<div class="form-group"><label>URL</label><input type="text" id="ef_url" value="https://github.com"></div>`,
    location: `<div class="form-group"><label>Latitude</label><input type="text" id="ef_lat" value="37.7749"><label>Longitude</label><input type="text" id="ef_lng" value="-122.4194"></div>`,
  }
  container.innerHTML = extras[type] || ''
}

async function sendDemo() {
  const jid = normalizeJid(document.getElementById('demoJid').value)
  const type = document.getElementById('demoType').value
  if (!jid) { showToast('Enter a target number first', 'error'); return }

  const payload = {}
  const efText = document.getElementById('ef_text')
  const efUrl = document.getElementById('ef_url')
  const efCaption = document.getElementById('ef_caption')
  const efLat = document.getElementById('ef_lat')
  const efLng = document.getElementById('ef_lng')
  if (efText) payload.text = efText.value
  if (efUrl) payload.url = efUrl.value
  if (efCaption) payload.caption = efCaption.value
  if (efLat) payload.lat = parseFloat(efLat.value)
  if (efLng) payload.lng = parseFloat(efLng.value)

  await apiSend(jid, type, payload)
}

async function quickDemo(type) {
  const jid = normalizeJid(document.getElementById('demoJid').value)
  if (!jid) { showToast('Set a target number in the Send Demo tab first', 'error'); return }
  await apiSend(jid, type, {})
}

async function apiSend(jid, type, payload) {
  try {
    const r = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jid, type, payload }),
    })
    const data = await r.json()
    if (data.success) showToast(`✅ Sent! ID: ${data.messageId || 'ok'}`, 'success')
    else showToast(`❌ ${data.error}`, 'error')
  } catch (e) {
    showToast(`❌ ${e.message}`, 'error')
  }
}

/* ── Groups Tab ──────────────────────────────────────────────────────────── */
async function loadGroups() {
  const el = document.getElementById('groupList')
  el.innerHTML = '<div style="color:var(--text2)">Loading…</div>'
  try {
    const groups = await fetch('/api/groups').then(r => r.json())
    const list = Object.values(groups)
    if (!list.length) { el.innerHTML = '<div style="color:var(--text2)">No groups found.</div>'; return }
    el.innerHTML = list.map(g => `
      <div class="chat-item" onclick="showGroupDetail(${escAttr(JSON.stringify(g))})">
        <div class="chat-avatar">👥</div>
        <div class="chat-info">
          <div class="chat-name">${escHtml(g.subject || g.id)}</div>
          <div class="chat-preview">${g.participants?.length || 0} members · ${escHtml(g.id)}</div>
        </div>
      </div>
    `).join('')
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red)">${escHtml(e.message)}</div>`
  }
}

function showGroupDetail(group) {
  const el = document.getElementById('groupDetail')
  const members = group.participants || []
  el.innerHTML = `
    <h2>${escHtml(group.subject || 'Group')}</h2>
    <div style="color:var(--text2);font-size:12px;margin-bottom:12px">${escHtml(group.id)}</div>
    ${group.desc ? `<div style="margin-bottom:12px">${escHtml(group.desc)}</div>` : ''}
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-secondary" onclick="getGroupInvite('${escAttr(group.id)}')">🔗 Get Invite Link</button>
      <button class="btn btn-secondary" onclick="selectChat('${escAttr(group.id)}','${escAttr(group.subject || '')}')">💬 Select Chat</button>
    </div>
    <h3>Members (${members.length})</h3>
    <div class="member-list">
      ${members.map(m => `
        <div class="member-item">
          <div class="member-avatar">👤</div>
          <div class="member-jid">${escHtml(m.id?.split('@')[0] || m.id)}</div>
          ${m.admin ? `<span class="admin-badge">${m.admin === 'superadmin' ? '⭐ Owner' : '🛡️ Admin'}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `
}

async function getGroupInvite(jid) {
  try {
    const r = await fetch(`/api/group/${encodeURIComponent(jid)}/invite`).then(r => r.json())
    if (r.link) {
      showToast(`🔗 Link copied!`, 'success')
      navigator.clipboard?.writeText(r.link).catch(() => {})
      alert(`Invite link:\n${r.link}`)
    } else showToast('Could not get invite link (need admin)', 'error')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

/* ── Privacy Tab ─────────────────────────────────────────────────────────── */
async function loadPrivacy() {
  const el = document.getElementById('privacySettings')
  el.innerHTML = '<div style="color:var(--text2)">Loading…</div>'
  try {
    const settings = await fetch('/api/privacy').then(r => r.json())
    el.innerHTML = `<table style="width:100%;border-collapse:collapse">` +
      Object.entries(settings).map(([k, v]) => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px;color:var(--text2)">${escHtml(k)}</td>
          <td style="padding:8px"><span class="badge green">${escHtml(String(v))}</span></td>
        </tr>
      `).join('') + `</table>`
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red)">${escHtml(e.message)}</div>`
  }
}

async function updateStatus() {
  const status = document.getElementById('newStatus').value.trim()
  if (!status) { showToast('Enter a status text', 'error'); return }
  try {
    const r = await fetch('/api/profile/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await r.json()
    if (data.success) showToast('✅ Status updated!', 'success')
    else showToast(`❌ ${data.error}`, 'error')
  } catch (e) {
    showToast(e.message, 'error')
  }
}

/* ── Logs Tab ────────────────────────────────────────────────────────────── */
function addLog(type, eventName, data) {
  const area = document.getElementById('logArea')
  const placeholder = area.querySelector('[style*="color:var(--text2)"]')
  if (placeholder && area.children.length === 1) placeholder.remove()

  const div = document.createElement('div')
  div.className = `log-entry type-${type}`
  const time = new Date().toLocaleTimeString()
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 0).slice(0, 200)
  div.innerHTML = `<span class="time">[${time}]</span> <span class="event-name">${escHtml(eventName)}</span> <span class="event-data">${escHtml(dataStr)}</span>`
  area.appendChild(div)
  area.scrollTop = area.scrollHeight
  if (area.children.length > 500) area.removeChild(area.firstChild)
}

function clearLogs() {
  document.getElementById('logArea').innerHTML = '<div class="log-entry" style="color:var(--text2)">Logs cleared.</div>'
}

/* ── Logout ──────────────────────────────────────────────────────────────── */
async function logout() {
  if (!confirm('Are you sure you want to logout?')) return
  showToast('Logging out…', 'error')
  // Trigger logout via socket event or api (not implemented in demo — restart to logout)
  showToast('Delete auth_info folder and restart to logout fully.', 'error')
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer')
  const div = document.createElement('div')
  div.className = `toast ${type}`
  div.textContent = message
  container.appendChild(div)
  setTimeout(() => div.remove(), 4000)
}

/* ── JID normalizer ──────────────────────────────────────────────────────── */
function normalizeJid(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  // Already a full JID (contains @)
  if (s.includes('@')) return s
  // Strip any non-digit characters (spaces, dashes, +)
  const digits = s.replace(/\D/g, '')
  // 10-digit number → prepend country code 91 (India)
  const number = digits.length === 10 ? '91' + digits : digits
  return number + '@s.whatsapp.net'
}

/* ── Utils ───────────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/* ── Init ────────────────────────────────────────────────────────────────── */
;(async () => {
  // Load initial status
  try {
    const status = await fetch('/api/status').then(r => r.json())
    if (status.connected) {
      setStatus('open', status.user)
    }
  } catch {}

  // Load demo types in background
  loadDemoTypes()
  loadPollHistory()
})()

/* ── Interactive Tab — shared helpers ───────────────────────────────────── */
function ixJid() {
  const jid = normalizeJid(document.getElementById('ixJid').value)
  if (!jid) { showToast('Enter a target number at the top first', 'error'); return null }
  return jid
}

function removeRow(btn) { btn.closest('.ix-row').remove() }

async function ixSend(payload) {
  try {
    const r = await fetch('/api/send-interactive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await r.json()
    if (data.success) showToast('✅ Sent! ID: ' + (data.messageId || 'ok'), 'success')
    else showToast('❌ ' + data.error, 'error')
  } catch (e) {
    showToast('❌ ' + e.message, 'error')
  }
}

// ── Scheduler Tab ─────────────────────────────────────────────────────────────

// ── Scheduler target selector ─────────────────────────────────────────────
let _scTargetMode = 'contact'

function scSwitchTarget(mode) {
  _scTargetMode = mode
  document.getElementById('sc_tab_contact').classList.toggle('active', mode === 'contact')
  document.getElementById('sc_tab_group').classList.toggle('active', mode === 'group')
  document.getElementById('sc_target_contact').style.display = mode === 'contact' ? '' : 'none'
  document.getElementById('sc_target_group').style.display   = mode === 'group'   ? '' : 'none'
  if (mode === 'group') scLoadGroups()
}

async function scLoadGroups() {
  const sel = document.getElementById('sc_jid_group')
  sel.innerHTML = '<option value="">Loading…</option>'
  try {
    const groups = await fetch('/api/groups').then(r => r.json())
    const list = Object.values(groups)
    if (!list.length) { sel.innerHTML = '<option value="">No groups found</option>'; return }
    sel.innerHTML = list.map(g =>
      `<option value="${escAttr(g.id)}">${escHtml(g.subject || g.id)} (${g.participants?.length || 0} members)</option>`
    ).join('')
  } catch (e) {
    sel.innerHTML = '<option value="">Error loading groups</option>'
  }
}

function scGetJid() {
  if (_scTargetMode === 'group') {
    const val = document.getElementById('sc_jid_group')?.value
    if (!val) { showToast('Select a group', 'error'); return null }
    return val
  }
  const jid = normalizeJid(document.getElementById('sc_jid_contact').value)
  if (!jid) { showToast('Enter a target number', 'error'); return null }
  return jid
}

const SC_BASIC_TYPES = [
  { id: 'text',       label: '💬 Text' },
  { id: 'image',      label: '🖼️ Image' },
  { id: 'video',      label: '🎬 Video' },
  { id: 'gif',        label: '🎞️ GIF' },
  { id: 'audio',      label: '🎵 Audio' },
  { id: 'document',   label: '📄 Document' },
  { id: 'location',   label: '📍 Location' },
]
const SC_INTERACTIVE_TYPES = [
  { id: 'custom_buttons',       label: '🔘 Quick-Reply Buttons' },
  { id: 'custom_list',          label: '📋 List / Menu' },
  { id: 'custom_poll',          label: '🗳️ Poll' },
  { id: 'custom_cta_url',       label: '🔗 CTA URL Button' },
  { id: 'custom_cta_call',      label: '📞 CTA Call Button' },
  { id: 'custom_cta_copy',      label: '📋 CTA Copy Button' },
  { id: 'custom_buttons_image', label: '🖼️ Image + Buttons' },
  { id: 'custom_carousel',      label: '🎠 Carousel' },
]

function scUpdateTypeList() {
  const cat = document.getElementById('sc_category').value
  const sel = document.getElementById('sc_type')
  const types = cat === 'send' ? SC_BASIC_TYPES : SC_INTERACTIVE_TYPES
  sel.innerHTML = '<option value="">Select type…</option>' +
    types.map(t => `<option value="${escAttr(t.id)}">${escHtml(t.label)}</option>`).join('')
  document.getElementById('sc_payload_fields').innerHTML = ''
}

function scUpdatePayloadFields() {
  const cat  = document.getElementById('sc_category').value
  const type = document.getElementById('sc_type').value
  const el   = document.getElementById('sc_payload_fields')
  if (!type) { el.innerHTML = ''; return }

  if (cat === 'send') {
    const fields = {
      text:     `<div class="form-group"><label>Message Text</label><textarea id="scf_text" placeholder="Your message…">Hello! 👋</textarea></div>`,
      image:    `<div class="form-group"><label>Image URL</label><input type="text" id="scf_url" value="https://picsum.photos/800/600"><label>Caption</label><input type="text" id="scf_caption" placeholder="Optional caption"></div>`,
      video:    `<div class="form-group"><label>Video URL</label><input type="text" id="scf_url" value="https://www.w3schools.com/html/mov_bbb.mp4"><label>Caption</label><input type="text" id="scf_caption" placeholder="Optional caption"></div>`,
      gif:      `<div class="form-group"><label>GIF URL (mp4)</label><input type="text" id="scf_url" value="https://media.giphy.com/media/l4pTfx2qLszoacZRS/giphy.mp4"></div>`,
      audio:    `<div class="form-group"><label>Audio URL (mp3/mp4)</label><input type="text" id="scf_url" value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"></div>`,
      document: `<div class="form-group"><label>Document URL</label><input type="text" id="scf_url" value="https://www.w3.org/WAI/WCAG21/Techniques/pdf/R12.pdf"><label>File Name</label><input type="text" id="scf_fileName" value="document.pdf"></div>`,
      location: `<div class="form-group"><label>Latitude</label><input type="text" id="scf_lat" value="37.7749"><label>Longitude</label><input type="text" id="scf_lng" value="-122.4194"></div>`,
    }
    el.innerHTML = fields[type] || ''
    return
  }

  // Interactive types — reuse same UI as Interactive tab
  if (type === 'custom_buttons') {
    el.innerHTML = `
      <div class="form-group"><label>Header (optional)</label><input type="text" id="scf_header" placeholder="Header…"></div>
      <div class="form-group"><label>Body Text</label><textarea id="scf_body">Choose an option:</textarea></div>
      <div class="form-group"><label>Footer (optional)</label><input type="text" id="scf_footer" placeholder="Footer…"></div>
      <div class="form-group"><label>Buttons <span class="badge">max 3</span></label>
        <div id="scf_btn_list">
          <div class="ix-row"><input type="text" class="scf-btn-label" value="Option 1" placeholder="Label"><input type="text" class="scf-btn-id" value="btn_1" placeholder="ID"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button></div>
          <div class="ix-row"><input type="text" class="scf-btn-label" value="Option 2" placeholder="Label"><input type="text" class="scf-btn-id" value="btn_2" placeholder="ID"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button></div>
        </div>
        <button class="btn btn-secondary ix-add" onclick="scAddBtnRow()">+ Add Button</button>
      </div>`
  } else if (type === 'custom_list') {
    el.innerHTML = `
      <div class="form-group"><label>Header</label><input type="text" id="scf_header" value="Choose an item"></div>
      <div class="form-group"><label>Body</label><textarea id="scf_body">Pick from the list below:</textarea></div>
      <div class="form-group"><label>Footer (optional)</label><input type="text" id="scf_footer"></div>
      <div class="form-group"><label>Button Label</label><input type="text" id="scf_buttonText" value="View Options"></div>
      <div class="form-group"><label>Sections</label><div id="scf_sections"></div><button class="btn btn-secondary ix-add" onclick="scAddListSection()">+ Add Section</button></div>`
    scAddListSection()
  } else if (type === 'custom_poll') {
    el.innerHTML = `
      <div class="form-group"><label>Poll Question</label><input type="text" id="scf_question" value="What do you think?"></div>
      <div class="form-group"><label>Options <span class="badge">2–12</span></label>
        <div id="scf_poll_opts">
          <div class="ix-row"><input type="text" class="scf-poll-opt" value="Option A" placeholder="Option"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button></div>
          <div class="ix-row"><input type="text" class="scf-poll-opt" value="Option B" placeholder="Option"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button></div>
        </div>
        <button class="btn btn-secondary ix-add" onclick="scAddPollOpt()">+ Add Option</button>
      </div>
      <div class="form-group"><label>Max Selectable</label><select id="scf_selectable"><option value="1">1 — Single</option><option value="2">2</option><option value="3" selected>3</option><option value="0">0 — Unlimited</option></select></div>`
  } else if (type === 'custom_cta_url') {
    el.innerHTML = `
      <div class="form-group"><label>Display Text</label><input type="text" id="scf_text" value="Check this out!"></div>
      <div class="form-group"><label>Button Label</label><input type="text" id="scf_label" value="Open Link"></div>
      <div class="form-group"><label>URL</label><input type="text" id="scf_url" value="https://github.com"></div>`
  } else if (type === 'custom_cta_call') {
    el.innerHTML = `
      <div class="form-group"><label>Display Text</label><input type="text" id="scf_text" value="Need help?"></div>
      <div class="form-group"><label>Button Label</label><input type="text" id="scf_label" value="Call Now"></div>
      <div class="form-group"><label>Phone Number</label><input type="text" id="scf_phone" placeholder="918907959595"></div>`
  } else if (type === 'custom_cta_copy') {
    el.innerHTML = `
      <div class="form-group"><label>Display Text</label><input type="text" id="scf_text" value="Use this promo code:"></div>
      <div class="form-group"><label>Button Label</label><input type="text" id="scf_label" value="Copy Code"></div>
      <div class="form-group"><label>Code</label><input type="text" id="scf_code" value="SAVE50"></div>`
  } else if (type === 'custom_buttons_image') {
    el.innerHTML = `
      <div class="form-group"><label>Image URL</label><input type="text" id="scf_imageUrl" value="https://picsum.photos/800/400"></div>
      <div class="form-group"><label>Caption</label><textarea id="scf_caption">Check this out!</textarea></div>
      <div class="form-group"><label>Footer (optional)</label><input type="text" id="scf_footer"></div>
      <div class="form-group"><label>Buttons <span class="badge">max 2</span></label>
        <div id="scf_imgbtn_list">
          <div class="ix-row"><input type="text" class="scf-imgbtn-label" value="Yes" placeholder="Label"><input type="text" class="scf-imgbtn-id" value="ib_yes" placeholder="ID"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button></div>
          <div class="ix-row"><input type="text" class="scf-imgbtn-label" value="No" placeholder="Label"><input type="text" class="scf-imgbtn-id" value="ib_no" placeholder="ID"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button></div>
        </div>
        <button class="btn btn-secondary ix-add" onclick="scAddImgBtnRow()">+ Add Button</button>
      </div>`
  } else if (type === 'custom_carousel') {
    el.innerHTML = `
      <div class="form-group"><label>Body Text</label><textarea id="scf_body">Browse our products:</textarea></div>
      <div id="scf_carousel_cards"></div>
      <button class="btn btn-secondary ix-add" onclick="scAddCarouselCard()">+ Add Card</button>`
    scAddCarouselCard()
  }
}

// Scheduler dynamic row helpers
function scAddBtnRow() {
  const list = document.getElementById('scf_btn_list')
  if (list?.children.length >= 3) { showToast('Max 3 buttons', 'error'); return }
  const n = (list?.children.length || 0) + 1
  const row = document.createElement('div'); row.className = 'ix-row'
  row.innerHTML = `<input type="text" class="scf-btn-label" value="Option ${n}" placeholder="Label"><input type="text" class="scf-btn-id" value="btn_${n}" placeholder="ID"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>`
  list.appendChild(row)
}
function scAddListSection() {
  const c = document.getElementById('scf_sections')
  const idx = c?.children.length + 1
  const div = document.createElement('div'); div.className = 'list-section'
  div.innerHTML = `<div class="list-section-header"><input type="text" class="section-title-input" value="Section ${idx}" placeholder="Section title"><button class="btn btn-secondary ix-remove" onclick="this.closest('.list-section').remove()">✕ Remove</button></div><div class="section-rows"></div><button class="btn btn-secondary ix-add" onclick="addListRow(this)">+ Add Row</button>`
  c.appendChild(div)
  addListRow(div.querySelector('.ix-add'))
}
function scAddPollOpt() {
  const list = document.getElementById('scf_poll_opts')
  if (list?.children.length >= 12) { showToast('Max 12 options', 'error'); return }
  const row = document.createElement('div'); row.className = 'ix-row'
  row.innerHTML = `<input type="text" class="scf-poll-opt" placeholder="Option"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>`
  list.appendChild(row)
}
function scAddImgBtnRow() {
  const list = document.getElementById('scf_imgbtn_list')
  if (list?.children.length >= 2) { showToast('Max 2 buttons', 'error'); return }
  const n = (list?.children.length || 0) + 1
  const row = document.createElement('div'); row.className = 'ix-row'
  row.innerHTML = `<input type="text" class="scf-imgbtn-label" value="Option ${n}" placeholder="Label"><input type="text" class="scf-imgbtn-id" value="ib_${n}" placeholder="ID"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>`
  list.appendChild(row)
}
function scAddCarouselCard() {
  const c = document.getElementById('scf_carousel_cards')
  const idx = (c?.children.length || 0) + 1
  const div = document.createElement('div'); div.className = 'carousel-card'
  div.innerHTML = `
    <div class="carousel-card-header">Card ${idx} <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px" onclick="this.closest('.carousel-card').remove()">✕ Remove</button></div>
    <div class="form-group"><label>Image URL</label><input type="text" class="scc-img" value="https://picsum.photos/seed/${idx}/600/400" placeholder="https://…"></div>
    <div class="form-group"><label>Title</label><input type="text" class="scc-title" value="Product ${idx}"></div>
    <div class="form-group"><label>Description</label><input type="text" class="scc-desc" value="Description ${idx}"></div>
    <div class="form-group"><label>Buttons <span class="badge">max 2</span></label>
      <div class="scc-btns">
        <div class="ix-row">
          <select class="scc-btn-type" style="flex:0 0 120px"><option value="quick_reply">Quick Reply</option><option value="cta_url">URL Button</option></select>
          <input type="text" class="scc-btn-label" placeholder="Label" value="Buy Now">
          <input type="text" class="scc-btn-value" placeholder="ID or URL" value="buy_${idx}">
          <button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>
        </div>
      </div>
      <button class="btn btn-secondary ix-add" onclick="scAddCarouselCardBtn(this)">+ Add Button</button>
    </div>`
  c.appendChild(div)
}
function scAddCarouselCardBtn(btn) {
  const btns = btn.previousElementSibling
  if (btns?.children.length >= 2) { showToast('Max 2 buttons per card', 'error'); return }
  const row = document.createElement('div'); row.className = 'ix-row'
  row.innerHTML = `<select class="scc-btn-type" style="flex:0 0 120px"><option value="quick_reply">Quick Reply</option><option value="cta_url">URL Button</option></select><input type="text" class="scc-btn-label" placeholder="Label"><input type="text" class="scc-btn-value" placeholder="ID or URL"><button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>`
  btns.appendChild(row)
}

// Schedule type fields
function scUpdateScheduleFields() {
  const type = document.querySelector('input[name="sc_schedule_type"]:checked')?.value
  const el = document.getElementById('sc_schedule_fields')
  if (type === 'once') {
    const min = new Date(Date.now() + 60000).toISOString().slice(0, 16)
    el.innerHTML = `<div class="form-group"><label>Send At</label><input type="datetime-local" id="scf_datetime" min="${min}" value="${min}" oninput="scUpdatePreview()"></div>`
  } else if (type === 'daily') {
    el.innerHTML = `<div class="form-group"><label>Time (every day)</label><input type="time" id="scf_time" value="09:00" oninput="scUpdatePreview()"></div>`
  } else if (type === 'weekly') {
    el.innerHTML = `
      <div class="form-group"><label>Day of Week</label>
        <select id="scf_day" onchange="scUpdatePreview()">
          <option value="MON">Monday</option><option value="TUE">Tuesday</option>
          <option value="WED">Wednesday</option><option value="THU">Thursday</option>
          <option value="FRI">Friday</option><option value="SAT">Saturday</option>
          <option value="SUN">Sunday</option>
        </select>
      </div>
      <div class="form-group"><label>Time</label><input type="time" id="scf_time" value="09:00" oninput="scUpdatePreview()"></div>`
  } else if (type === 'interval') {
    el.innerHTML = `
      <div class="form-group"><label>Repeat Every</label>
        <div class="ix-row" style="margin:0">
          <input type="number" id="scf_interval_val" value="30" min="1" style="flex:1" oninput="scUpdatePreview()">
          <select id="scf_interval_unit" style="flex:0 0 110px" onchange="scUpdatePreview()">
            <option value="60">Minutes</option>
            <option value="3600" selected>Hours</option>
            <option value="86400">Days</option>
          </select>
        </div>
      </div>`
  }
  scUpdatePreview()
}

function scGetScheduleValue() {
  const type = document.querySelector('input[name="sc_schedule_type"]:checked')?.value
  if (type === 'once')     return document.getElementById('scf_datetime')?.value || ''
  if (type === 'daily')    return document.getElementById('scf_time')?.value || '09:00'
  if (type === 'weekly') {
    const day  = document.getElementById('scf_day')?.value || 'MON'
    const time = document.getElementById('scf_time')?.value || '09:00'
    return `${day}:${time}`
  }
  if (type === 'interval') {
    const val  = parseInt(document.getElementById('scf_interval_val')?.value || 30)
    const unit = parseInt(document.getElementById('scf_interval_unit')?.value || 3600)
    return String(val * unit)
  }
  return ''
}

function scUpdatePreview() {
  const el = document.getElementById('sc_preview')
  const type = document.querySelector('input[name="sc_schedule_type"]:checked')?.value
  const value = scGetScheduleValue()
  if (!value) return
  try {
    let desc = ''
    if (type === 'once')     desc = `Sends once at <strong>${new Date(value).toLocaleString()}</strong>`
    if (type === 'daily')    desc = `Sends every day at <strong>${value}</strong>`
    if (type === 'weekly') {
      const [day, time] = value.split(':')
      desc = `Sends every <strong>${day}</strong> at <strong>${time}</strong>`
    }
    if (type === 'interval') {
      const secs = parseInt(value)
      const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
      const humanInterval = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
      desc = `Repeats every <strong>${humanInterval}</strong>`
    }
    el.innerHTML = `<div style="font-size:12px;color:var(--text2);margin-bottom:4px">Schedule Preview</div><div>${desc}</div>`
  } catch {}
}

function scCollectPayload() {
  const cat  = document.getElementById('sc_category').value
  const type = document.getElementById('sc_type').value
  if (!type) return null

  if (cat === 'send') {
    const p = {}
    const text     = document.getElementById('scf_text')
    const url      = document.getElementById('scf_url')
    const caption  = document.getElementById('scf_caption')
    const lat      = document.getElementById('scf_lat')
    const lng      = document.getElementById('scf_lng')
    const fileName = document.getElementById('scf_fileName')
    if (text)     p.text     = text.value
    if (url)      p.url      = url.value
    if (caption)  p.caption  = caption.value
    if (lat)      p.lat      = parseFloat(lat.value)
    if (lng)      p.lng      = parseFloat(lng.value)
    if (fileName) p.fileName = fileName.value
    return p
  }

  // Interactive
  if (type === 'custom_buttons') {
    return {
      header: document.getElementById('scf_header')?.value || '',
      body:   document.getElementById('scf_body')?.value || '',
      footer: document.getElementById('scf_footer')?.value || '',
      buttons: [...document.querySelectorAll('#scf_btn_list .ix-row')].map(r => ({
        label: r.querySelector('.scf-btn-label')?.value || '',
        id:    r.querySelector('.scf-btn-id')?.value || '',
      })).filter(b => b.label),
    }
  }
  if (type === 'custom_list') {
    return {
      header:     document.getElementById('scf_header')?.value || '',
      body:       document.getElementById('scf_body')?.value || '',
      footer:     document.getElementById('scf_footer')?.value || '',
      buttonText: document.getElementById('scf_buttonText')?.value || 'View Options',
      sections: [...document.querySelectorAll('#scf_sections .list-section')].map(sec => ({
        title: sec.querySelector('.section-title-input')?.value || '',
        rows: [...sec.querySelectorAll('.ix-row')].map(r => ({
          title:       r.querySelector('.row-title')?.value || '',
          rowId:       r.querySelector('.row-id')?.value || ('row_' + Date.now()),
          description: r.querySelector('.row-desc')?.value || '',
        })).filter(r => r.title),
      })).filter(s => s.rows.length),
    }
  }
  if (type === 'custom_poll') {
    return {
      question:       document.getElementById('scf_question')?.value || '',
      options:        [...document.querySelectorAll('#scf_poll_opts .scf-poll-opt')].map(i => i.value).filter(Boolean),
      selectableCount: parseInt(document.getElementById('scf_selectable')?.value || 1),
    }
  }
  if (type === 'custom_cta_url')  return { text: document.getElementById('scf_text')?.value, label: document.getElementById('scf_label')?.value, url: document.getElementById('scf_url')?.value }
  if (type === 'custom_cta_call') return { text: document.getElementById('scf_text')?.value, label: document.getElementById('scf_label')?.value, phone: document.getElementById('scf_phone')?.value }
  if (type === 'custom_cta_copy') return { text: document.getElementById('scf_text')?.value, label: document.getElementById('scf_label')?.value, code: document.getElementById('scf_code')?.value }
  if (type === 'custom_buttons_image') {
    return {
      imageUrl: document.getElementById('scf_imageUrl')?.value || '',
      caption:  document.getElementById('scf_caption')?.value || '',
      footer:   document.getElementById('scf_footer')?.value || '',
      buttons: [...document.querySelectorAll('#scf_imgbtn_list .ix-row')].map(r => ({
        label: r.querySelector('.scf-imgbtn-label')?.value || '',
        id:    r.querySelector('.scf-imgbtn-id')?.value || '',
      })).filter(b => b.label),
    }
  }
  if (type === 'custom_carousel') {
    return {
      body: document.getElementById('scf_body')?.value || '',
      cards: [...document.querySelectorAll('#scf_carousel_cards .carousel-card')].map(card => ({
        imageUrl:    card.querySelector('.scc-img')?.value || '',
        title:       card.querySelector('.scc-title')?.value || '',
        description: card.querySelector('.scc-desc')?.value || '',
        buttons: [...card.querySelectorAll('.scc-btns .ix-row')].map(r => ({
          type:  r.querySelector('.scc-btn-type')?.value || 'quick_reply',
          label: r.querySelector('.scc-btn-label')?.value || '',
          value: r.querySelector('.scc-btn-value')?.value || '',
        })).filter(b => b.label),
      })).filter(c => c.imageUrl),
    }
  }
  return {}
}

async function createSchedule() {
  const jid = scGetJid()
  if (!jid) return
  const endpoint = document.getElementById('sc_category').value
  const type = document.getElementById('sc_type').value
  if (!type) { showToast('Select a message type', 'error'); return }
  const scheduleType  = document.querySelector('input[name="sc_schedule_type"]:checked')?.value
  const scheduleValue = scGetScheduleValue()
  if (!scheduleValue) { showToast('Set a schedule time', 'error'); return }
  const payload = scCollectPayload()
  if (!payload) { showToast('Fill in the message fields', 'error'); return }
  const label = document.getElementById('sc_label').value.trim()

  try {
    const r = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, jid, endpoint, type, payload, schedule_type: scheduleType, schedule_value: scheduleValue }),
    })
    const data = await r.json()
    if (data.success) {
      showToast('✅ Schedule saved!', 'success')
      document.getElementById('sc_label').value = ''
      loadScheduler()
    } else {
      showToast('❌ ' + data.error, 'error')
    }
  } catch (e) { showToast('❌ ' + e.message, 'error') }
}

async function loadScheduler() {
  const el = document.getElementById('scheduleList')
  try {
    const rows = await fetch('/api/schedules').then(r => r.json())
    if (!rows.length) { el.innerHTML = '<div style="color:var(--text2);padding:12px">No schedules yet.</div>'; return }
    const allTypes = [...SC_BASIC_TYPES, ...SC_INTERACTIVE_TYPES]
    el.innerHTML = `<table class="schedule-table">
      <thead><tr>
        <th>Label</th><th>To</th><th>Type</th><th>Schedule</th><th>Next Run</th><th>Status</th><th>Actions</th>
      </tr></thead>
      <tbody>${rows.map(s => {
        const typeLabel = allTypes.find(t => t.id === s.type)?.label || s.type
        const schedDesc = scFormatScheduleDesc(s.schedule_type, s.schedule_value)
        const nextRun   = s.next_run ? scFormatNextRun(s.next_run) : '—'
        const status    = s.enabled ? (s.schedule_type === 'once' && s.next_run < Date.now() ? 'done' : 'active') : 'disabled'
        const statusLabel = status === 'active' ? '● Active' : status === 'done' ? '✓ Done' : '⏸ Paused'
        const isGroup = s.jid.endsWith('@g.us')
        const target = isGroup
          ? `<span style="color:var(--blue)">👥 ${escHtml(s.jid.split('@')[0])}</span>`
          : `<code style="color:var(--green);font-size:12px">+${escHtml(s.jid.split('@')[0])}</code>`
        return `<tr>
          <td>${escHtml(s.label || '—')}</td>
          <td>${target}</td>
          <td>${escHtml(typeLabel)}</td>
          <td style="color:var(--text2);font-size:12px">${escHtml(schedDesc)}</td>
          <td style="font-size:12px">${escHtml(nextRun)}</td>
          <td><span class="sc-status ${status}">${statusLabel}</span></td>
          <td>
            <div class="sc-actions">
              <button class="btn btn-secondary" onclick="scRunNow(${s.id})">▶ Now</button>
              <button class="btn btn-secondary" onclick="scToggle(${s.id}, ${s.enabled})">${s.enabled ? '⏸ Pause' : '▶ Resume'}</button>
              <button class="btn btn-danger" onclick="scDelete(${s.id})">🗑</button>
            </div>
          </td>
        </tr>`
      }).join('')}</tbody>
    </table>`
  } catch (e) {
    el.innerHTML = `<div style="color:var(--red)">${escHtml(e.message)}</div>`
  }
}

function scFormatScheduleDesc(type, value) {
  if (type === 'once')     return `Once: ${new Date(value).toLocaleString()}`
  if (type === 'daily')    return `Daily at ${value}`
  if (type === 'weekly') {
    const [day, time] = value.split(':')
    return `Every ${day} at ${time}`
  }
  if (type === 'interval') {
    const secs = parseInt(value)
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
    return `Every ${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim()
  }
  return value
}

function scFormatNextRun(ms) {
  const d = new Date(ms)
  const now = new Date()
  const diff = ms - Date.now()
  if (diff < 0) return 'Due'
  if (d.toDateString() === now.toDateString()) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function scRunNow(id) {
  try {
    const r = await fetch(`/api/schedules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runNow: true }) })
    const d = await r.json()
    if (d.success) showToast('✅ Sent now!', 'success')
    else showToast('❌ ' + d.error, 'error')
  } catch (e) { showToast('❌ ' + e.message, 'error') }
}

async function scToggle(id, currentEnabled) {
  try {
    await fetch(`/api/schedules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: currentEnabled ? 0 : 1 }) })
    loadScheduler()
  } catch (e) { showToast('❌ ' + e.message, 'error') }
}

async function scDelete(id) {
  if (!confirm('Delete this schedule?')) return
  try {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    loadScheduler()
  } catch (e) { showToast('❌ ' + e.message, 'error') }
}

// Socket event for fired schedules
socket.on('schedule_fired', ({ id, label, success, error }) => {
  if (success) showToast(`⏰ Schedule fired: ${label || 'id=' + id}`, 'success')
  else showToast(`⏰ Schedule failed: ${error}`, 'error')
  loadScheduler()
})

// Sync ixJid ↔ demoJid when Interactive tab loads
document.querySelector('[data-tab="interactive"]').addEventListener('click', () => {
  const demo = document.getElementById('demoJid')?.value.trim()
  const ix = document.getElementById('ixJid')
  if (!ix.value && demo) ix.value = demo
  // init carousel with one card if empty
  if (!document.getElementById('carousel_cards').children.length) addCarouselCard()
  // init list with one section if empty
  if (!document.getElementById('list_sections').children.length) addListSection()
})

/* ── Buttons Builder ─────────────────────────────────────────────────────── */
function addButtonRow() {
  const list = document.getElementById('btn_list')
  if (list.children.length >= 3) { showToast('Max 3 buttons', 'error'); return }
  const n = list.children.length + 1
  const row = document.createElement('div')
  row.className = 'ix-row'
  row.innerHTML = `
    <input type="text" placeholder="Button label" class="btn-label" value="Option ${n}">
    <input type="text" placeholder="Button ID (unique)" class="btn-id" value="btn_${n}">
    <button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>
  `
  list.appendChild(row)
}

async function sendCustomButtons() {
  const jid = ixJid(); if (!jid) return
  const header = document.getElementById('btn_header').value.trim()
  const body = document.getElementById('btn_body').value.trim()
  const footer = document.getElementById('btn_footer').value.trim()
  const rows = [...document.querySelectorAll('#btn_list .ix-row')]
  if (!body) { showToast('Body text is required', 'error'); return }
  if (!rows.length) { showToast('Add at least one button', 'error'); return }
  const buttons = rows.map(r => ({
    label: r.querySelector('.btn-label').value.trim(),
    id: r.querySelector('.btn-id').value.trim(),
  })).filter(b => b.label)
  await ixSend({ jid, type: 'custom_buttons', payload: { header, body, footer, buttons } })
}

/* ── List Builder ────────────────────────────────────────────────────────── */
function addListSection() {
  const container = document.getElementById('list_sections')
  const idx = container.children.length
  const div = document.createElement('div')
  div.className = 'list-section'
  div.innerHTML = `
    <div class="list-section-header">
      <input type="text" placeholder="Section title" class="section-title-input" value="Section ${idx + 1}">
      <button class="btn btn-secondary ix-remove" onclick="this.closest('.list-section').remove()">✕ Remove Section</button>
    </div>
    <div class="section-rows"></div>
    <button class="btn btn-secondary ix-add" onclick="addListRow(this)">+ Add Row</button>
  `
  container.appendChild(div)
  // add one default row
  addListRow(div.querySelector('.ix-add'))
}

function addListRow(btn) {
  const rows = btn.previousElementSibling
  const n = rows.children.length + 1
  const row = document.createElement('div')
  row.className = 'ix-row'
  row.innerHTML = `
    <input type="text" placeholder="Row title" class="row-title" value="Item ${n}" style="flex:2">
    <input type="text" placeholder="Row ID (unique)" class="row-id" value="row_${Date.now()}">
    <input type="text" placeholder="Description (optional)" class="row-desc">
    <button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>
  `
  rows.appendChild(row)
}

async function sendCustomList() {
  const jid = ixJid(); if (!jid) return
  const header = document.getElementById('list_header').value.trim()
  const body = document.getElementById('list_body').value.trim()
  const footer = document.getElementById('list_footer').value.trim()
  const buttonText = document.getElementById('list_btn_text').value.trim() || 'View Options'
  if (!body) { showToast('Body text is required', 'error'); return }

  const sections = [...document.querySelectorAll('#list_sections .list-section')].map(sec => ({
    title: sec.querySelector('.section-title-input').value.trim(),
    rows: [...sec.querySelectorAll('.ix-row')].map(r => ({
      title: r.querySelector('.row-title').value.trim(),
      rowId: r.querySelector('.row-id').value.trim() || ('row_' + Date.now()),
      description: r.querySelector('.row-desc').value.trim(),
    })).filter(r => r.title),
  })).filter(s => s.rows.length)

  if (!sections.length) { showToast('Add at least one section with a row', 'error'); return }
  await ixSend({ jid, type: 'custom_list', payload: { header, body, footer, buttonText, sections } })
}

/* ── Poll Builder ────────────────────────────────────────────────────────── */
function addPollOption() {
  const list = document.getElementById('poll_options')
  if (list.children.length >= 12) { showToast('Max 12 options', 'error'); return }
  const row = document.createElement('div')
  row.className = 'ix-row'
  row.innerHTML = `
    <input type="text" placeholder="Option" class="poll-opt">
    <button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>
  `
  list.appendChild(row)
}

async function sendCustomPoll() {
  const jid = ixJid(); if (!jid) return
  const question = document.getElementById('poll_question').value.trim()
  if (!question) { showToast('Poll question is required', 'error'); return }
  const options = [...document.querySelectorAll('#poll_options .poll-opt')]
    .map(i => i.value.trim()).filter(Boolean)
  if (options.length < 2) { showToast('Add at least 2 options', 'error'); return }
  const selectableCount = parseInt(document.getElementById('poll_selectable').value)
  await ixSend({ jid, type: 'custom_poll', payload: { question, options, selectableCount } })
}

/* ── CTA URL Builder ─────────────────────────────────────────────────────── */
async function sendCustomCtaUrl() {
  const jid = ixJid(); if (!jid) return
  const text = document.getElementById('cta_url_text').value.trim()
  const label = document.getElementById('cta_url_label').value.trim()
  const url = document.getElementById('cta_url_url').value.trim()
  if (!text || !url) { showToast('Text and URL are required', 'error'); return }
  await ixSend({ jid, type: 'custom_cta_url', payload: { text, label, url } })
}

/* ── CTA Call Builder ────────────────────────────────────────────────────── */
async function sendCustomCtaCall() {
  const jid = ixJid(); if (!jid) return
  const text = document.getElementById('cta_call_text').value.trim()
  const label = document.getElementById('cta_call_label').value.trim()
  const phone = document.getElementById('cta_call_phone').value.trim()
  if (!text || !phone) { showToast('Text and phone number are required', 'error'); return }
  await ixSend({ jid, type: 'custom_cta_call', payload: { text, label, phone } })
}

/* ── CTA Copy Builder ────────────────────────────────────────────────────── */
async function sendCustomCtaCopy() {
  const jid = ixJid(); if (!jid) return
  const text = document.getElementById('cta_copy_text').value.trim()
  const label = document.getElementById('cta_copy_label').value.trim()
  const code = document.getElementById('cta_copy_code').value.trim()
  if (!text || !code) { showToast('Text and copy code are required', 'error'); return }
  await ixSend({ jid, type: 'custom_cta_copy', payload: { text, label, code } })
}

/* ── Image + Buttons Builder ─────────────────────────────────────────────── */
function addImgButtonRow() {
  const list = document.getElementById('imgbtn_list')
  if (list.children.length >= 2) { showToast('Max 2 buttons for image messages', 'error'); return }
  const n = list.children.length + 1
  const row = document.createElement('div')
  row.className = 'ix-row'
  row.innerHTML = `
    <input type="text" placeholder="Button label" class="imgbtn-label" value="Option ${n}">
    <input type="text" placeholder="Button ID" class="imgbtn-id" value="ib_${n}">
    <button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>
  `
  list.appendChild(row)
}

async function sendCustomImgButtons() {
  const jid = ixJid(); if (!jid) return
  const imageUrl = document.getElementById('imgbtn_url').value.trim()
  const caption = document.getElementById('imgbtn_caption').value.trim()
  const footer = document.getElementById('imgbtn_footer').value.trim()
  if (!imageUrl) { showToast('Image URL is required', 'error'); return }
  const buttons = [...document.querySelectorAll('#imgbtn_list .ix-row')].map(r => ({
    label: r.querySelector('.imgbtn-label').value.trim(),
    id: r.querySelector('.imgbtn-id').value.trim(),
  })).filter(b => b.label)
  await ixSend({ jid, type: 'custom_buttons_image', payload: { imageUrl, caption, footer, buttons } })
}

/* ── Carousel Builder ────────────────────────────────────────────────────── */
function addCarouselCard() {
  const container = document.getElementById('carousel_cards')
  const idx = container.children.length + 1
  const div = document.createElement('div')
  div.className = 'carousel-card'
  div.innerHTML = `
    <div class="carousel-card-header">
      Card ${idx}
      <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px" onclick="this.closest('.carousel-card').remove()">✕ Remove</button>
    </div>
    <div class="form-group">
      <label>Image URL</label>
      <input type="text" placeholder="https://…" class="cc-img" value="https://picsum.photos/seed/${idx}/600/400">
    </div>
    <div class="form-group">
      <label>Title</label>
      <input type="text" placeholder="Card title" class="cc-title" value="Product ${idx}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <input type="text" placeholder="Short description" class="cc-desc" value="Description for product ${idx}">
    </div>
    <div class="form-group">
      <label>Buttons for this card <span class="badge">max 2</span></label>
      <div class="cc-btns">
        <div class="ix-row">
          <select class="cc-btn-type" style="flex:0 0 120px">
            <option value="quick_reply">Quick Reply</option>
            <option value="cta_url">URL Button</option>
          </select>
          <input type="text" placeholder="Label" class="cc-btn-label" value="Buy Now">
          <input type="text" placeholder="ID or URL" class="cc-btn-value" value="buy_${idx}">
          <button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>
        </div>
      </div>
      <button class="btn btn-secondary ix-add" onclick="addCarouselCardBtn(this)">+ Add Button</button>
    </div>
  `
  container.appendChild(div)
}

function addCarouselCardBtn(btn) {
  const btns = btn.previousElementSibling
  if (btns.children.length >= 2) { showToast('Max 2 buttons per card', 'error'); return }
  const row = document.createElement('div')
  row.className = 'ix-row'
  row.innerHTML = `
    <select class="cc-btn-type" style="flex:0 0 120px">
      <option value="quick_reply">Quick Reply</option>
      <option value="cta_url">URL Button</option>
    </select>
    <input type="text" placeholder="Label" class="cc-btn-label">
    <input type="text" placeholder="ID or URL" class="cc-btn-value">
    <button class="btn btn-secondary ix-remove" onclick="removeRow(this)">✕</button>
  `
  btns.appendChild(row)
}

async function sendCustomCarousel() {
  const jid = ixJid(); if (!jid) return
  const body = document.getElementById('carousel_body').value.trim()
  const cards = [...document.querySelectorAll('.carousel-card')].map(card => ({
    imageUrl: card.querySelector('.cc-img').value.trim(),
    title: card.querySelector('.cc-title').value.trim(),
    description: card.querySelector('.cc-desc').value.trim(),
    buttons: [...card.querySelectorAll('.cc-btns .ix-row')].map(r => ({
      type: r.querySelector('.cc-btn-type').value,
      label: r.querySelector('.cc-btn-label').value.trim(),
      value: r.querySelector('.cc-btn-value').value.trim(),
    })).filter(b => b.label),
  })).filter(c => c.imageUrl)
  if (!cards.length) { showToast('Add at least one card', 'error'); return }
  await ixSend({ jid, type: 'custom_carousel', payload: { body, cards } })
}
