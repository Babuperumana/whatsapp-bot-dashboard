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
function showPollResult(result) {
  const el = document.getElementById('pollResults')
  const total = result.results.reduce((s, o) => s + o.count, 0)
  el.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">Poll Results (ID: ${escHtml(result.pollId || '')})</div>
    ${result.results.map(opt => {
      const pct = total > 0 ? Math.round((opt.count / total) * 100) : 0
      return `
        <div class="poll-option">
          <div class="poll-label">
            <span>${escHtml(opt.option)}</span>
            <span>${opt.count} vote${opt.count !== 1 ? 's' : ''} (${pct}%)</span>
          </div>
          <div class="poll-bar-wrap"><div class="poll-bar" style="width:${pct}%"></div></div>
        </div>
      `
    }).join('')}
  `
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
    if (!chats.length) { el.innerHTML = '<div style="color:var(--text2)">No chats found.</div>'; return }
    el.innerHTML = chats.map(c => {
      const isGroup = c.id?.endsWith('@g.us')
      const icon = isGroup ? '👥' : '👤'
      const name = c.name || c.id?.split('@')[0] || c.id
      const preview = c.conversationTimestamp ? new Date(c.conversationTimestamp * 1000).toLocaleDateString() : ''
      return `
        <div class="chat-item" onclick="selectChat('${escAttr(c.id)}','${escAttr(name)}')">
          <div class="chat-avatar">${icon}</div>
          <div class="chat-info">
            <div class="chat-name">${escHtml(name)}</div>
            <div class="chat-preview">${escHtml(c.id || '')}</div>
          </div>
          <div class="chat-time">${escHtml(preview)}</div>
        </div>
      `
    }).join('')
    document.getElementById('statChats').textContent = chats.length
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
  const jid = document.getElementById('sendJid').value.trim()
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
  const jid = document.getElementById('demoJid').value.trim()
  const type = document.getElementById('demoType').value
  if (!jid) { showToast('Enter a target JID first', 'error'); return }

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
  const jid = document.getElementById('demoJid').value.trim()
  if (!jid) { showToast('Set a target JID in the Send Demo tab first', 'error'); return }
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
})()
