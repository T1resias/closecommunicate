// ═══════════════════════════════════════════════════════════
// Geohash (客户端)
// ═══════════════════════════════════════════════════════════
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const BITS = [16, 8, 4, 2, 1]

function ghEncode(lat, lng, precision = 8) {
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180
  let hash = '', bit = 0, charIndex = 0, isEven = true
  while (hash.length < precision) {
    if (isEven) { const mid = (minLng + maxLng) / 2; if (lng >= mid) { charIndex |= BITS[bit]; minLng = mid } else maxLng = mid }
    else { const mid = (minLat + maxLat) / 2; if (lat >= mid) { charIndex |= BITS[bit]; minLat = mid } else maxLat = mid }
    isEven = !isEven; bit++
    if (bit === 5) { hash += BASE32[charIndex]; bit = 0; charIndex = 0 }
  }
  return hash
}

function ghDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ═══════════════════════════════════════════════════════════
// 全局状态
// ═══════════════════════════════════════════════════════════
let userId = localStorage.getItem('cc_uid') || ''
let nickname = ''
let currentLoc = null
let currentGeohash = ''
let forums = []
let currentForumId = null
let currentForum = null
let pollingTimer = null
let sseSource = null

// ═══════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (userId) headers['X-User-Id'] = userId
  const res = await fetch(path, {
    headers,
    ...opts,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {})
  })
  return res.json()
}

// ═══════════════════════════════════════════════════════════
// 登录
// ═══════════════════════════════════════════════════════════
async function login() {
  if (!userId) {
    const data = await api('/api/login', { method: 'POST' })
    userId = data.userId
    nickname = data.nickname
    localStorage.setItem('cc_uid', userId)
  }
}

// ═══════════════════════════════════════════════════════════
// 位置
// ═══════════════════════════════════════════════════════════
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('浏览器不支持定位'))
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        if (err.code === 1) reject(new Error('LOCATION_DENIED'))
        else reject(err)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  })
}

async function refreshLocation() {
  const loc = await getLocation()
  const gh = ghEncode(loc.lat, loc.lng)
  loc.geohash = gh
  return loc
}

function startPolling() {
  stopPolling()
  const poll = async () => {
    try {
      const loc = await refreshLocation()
      const oldGh = currentGeohash
      currentLoc = loc
      currentGeohash = loc.geohash

      await api('/api/presence', { method: 'PUT', body: { lat: loc.lat, lng: loc.lng, geohash: loc.geohash } })

      if (oldGh !== loc.geohash && document.getElementById('page-home').classList.contains('active')) {
        await loadForums()
      }
    } catch (e) {
      if (e.message === 'LOCATION_DENIED') {
        document.getElementById('locationStatus').innerHTML = '<span class="location-dot error"></span>位置权限被拒绝'
      }
    }
    pollingTimer = setTimeout(poll, 30000)
  }
  poll()
}

function stopPolling() {
  if (pollingTimer) { clearTimeout(pollingTimer); pollingTimer = null }
}

// ═══════════════════════════════════════════════════════════
// 论坛列表
// ═══════════════════════════════════════════════════════════
async function loadForums() {
  const list = document.getElementById('forumList')
  const loading = document.getElementById('homeLoading')
  document.getElementById('locationStatus').innerHTML = '<span class="location-dot"></span>当前位置附近'

  if (!currentGeohash) return
  loading.style.display = 'flex'
  list.querySelectorAll('.forum-card').forEach(el => el.remove())

  try {
    const data = await api(`/api/forums?lat=${currentLoc.lat}&lng=${currentLoc.lng}&geohash=${currentGeohash}`)
    loading.style.display = 'none'

    if (data.code === 0 && data.forums.length > 0) {
      forums = data.forums
      data.forums.forEach(f => renderForumCard(f, false))
    } else {
      list.innerHTML += '<div class="empty"><p>附近暂无论坛</p><p style="font-size:12px;color:#bbb">换个地方看看？</p></div>'
    }
  } catch (e) {
    loading.style.display = 'none'
    list.innerHTML += '<div class="error-card"><p>加载失败</p><button class="retry-btn" onclick="loadForums()">重试</button></div>'
  }
}

function renderForumCard(f, isChild) {
  const list = document.getElementById('forumList')
  const types = { mall: '商场', community: '小区', school: '学校', office: '写字楼', scenic: '景区', other: '附近' }
  const card = document.createElement('div')
  card.className = 'forum-card' + (isChild ? ' child' : '')
  card.onclick = () => enterForum(f)
  card.innerHTML = `
    <div class="forum-main">
      <div class="forum-avatar">${f.name[0] || '地'}</div>
      <div class="forum-info">
        <div class="forum-name">${f.name}</div>
        <div class="forum-tag">${types[f.type] || '附近'}</div>
      </div>
    </div>
    ${f.description ? `<div class="forum-desc">${f.description}</div>` : ''}
    <div class="forum-footer">
      ${f.member_count ? `${f.member_count} 人在线` : ''}
    </div>`
  list.appendChild(card)

  // 渲染子论坛
  if (f.children && f.children.length) {
    f.children.forEach(child => renderForumCard(child, true))
  }
}

// ═══════════════════════════════════════════════════════════
// 进入论坛
// ═══════════════════════════════════════════════════════════
async function enterForum(f) {
  currentForumId = f.id
  currentForum = f

  document.getElementById('page-home').classList.remove('active')
  document.getElementById('page-forum').classList.add('active')
  document.getElementById('forumTitle').textContent = f.name
  document.getElementById('forumName').textContent = f.name
  document.getElementById('forumType').textContent = ''
  document.getElementById('forumDesc').textContent = f.description || ''
  document.getElementById('forumAddr').textContent = f.address || ''
  document.getElementById('forumMeta').textContent = ''

  document.getElementById('msgList').innerHTML = '<div class="loading"><div class="spinner"></div><p>加载中...</p></div>'
  document.getElementById('msgInput').value = ''

  // 加载 POI
  api(`/api/poi?lat=${currentLoc.lat}&lng=${currentLoc.lng}`).then(data => {
    if (data.poi) {
      document.getElementById('forumName').textContent = data.poi.name || f.name
      document.getElementById('forumDesc').textContent = data.poi.description || ''
      document.getElementById('forumAddr').innerHTML = `<span class="addr-dot"></span>${data.poi.address || ''}`
      const types = { mall: '商场', community: '小区', school: '学校', office: '写字楼', scenic: '景区', other: '附近' }
      document.getElementById('forumType').textContent = types[data.poi.type] || ''
    }
    if (currentLoc && f.lat) {
      document.getElementById('forumMeta').textContent = `距您 ${Math.round(ghDistance(currentLoc.lat, currentLoc.lng, f.lat, f.lng))}m`
    }
  })

  await loadMessages()
  connectSSE()
}

async function loadMessages() {
  const data = await api(`/api/messages/${currentForumId}?limit=20`)
  const list = document.getElementById('msgList')
  list.innerHTML = ''

  if (data.messages && data.messages.length > 0) {
    data.messages.forEach(m => renderMessage(m))
  } else {
    list.innerHTML = '<div class="empty"><p>暂无消息，发第一条吧</p></div>'
  }
  list.scrollTop = list.scrollHeight
}

function renderMessage(m) {
  const list = document.getElementById('msgList')
  list.querySelector('.empty')?.remove()

  const isMine = m.user_id === userId
  const div = document.createElement('div')
  div.className = 'msg-item' + (isMine ? ' mine' : '')
  div.innerHTML = `
    <div class="msg-avatar">${m.nickname ? m.nickname[0] : '匿'}</div>
    <div class="msg-body">
      <div class="msg-meta">
        <span>${m.nickname || '匿名'}</span>
        <span>${formatTime(m.create_time)}</span>
      </div>
      <div class="msg-bubble">${escapeHtml(m.content)}</div>
    </div>`
  list.appendChild(div)
  list.scrollTop = list.scrollHeight
}

function connectSSE() {
  if (sseSource) sseSource.close()
  sseSource = new EventSource(`/api/stream/${currentForumId}`)

  sseSource.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'connected') return
      // 去重
      const exists = document.querySelector(`[data-msgid="${msg.id}"]`)
      if (!exists) {
        const div = document.createElement('div')
        div.setAttribute('data-msgid', msg.id)
        document.getElementById('msgList').appendChild(div)
        renderMessage(msg)
      }
    } catch (_) {}
  }
}

async function sendMsg() {
  const input = document.getElementById('msgInput')
  const content = input.value.trim()
  if (!content) return

  input.value = ''
  const data = await api('/api/messages', { method: 'POST', body: { forumId: currentForumId, content } })
  if (data.code !== 0) {
    alert(data.msg || '发送失败')
  }
}

// ═══════════════════════════════════════════════════════════
// 页面导航
// ═══════════════════════════════════════════════════════════
function goHome() {
  if (sseSource) { sseSource.close(); sseSource = null }
  document.getElementById('page-forum').classList.remove('active')
  document.getElementById('page-post').classList.remove('active')
  document.getElementById('page-home').classList.add('active')
  currentForumId = null
  currentForum = null
}

function goBack() {
  document.getElementById('page-post').classList.remove('active')
  document.getElementById('page-forum').classList.add('active')
}

function submitPost() {
  const content = document.getElementById('postContent').value.trim()
  if (!content) return

  api('/api/messages', { method: 'POST', body: { forumId: currentForumId, content } }).then(data => {
    if (data.code === 0) {
      document.getElementById('postContent').value = ''
      document.getElementById('page-post').classList.remove('active')
      document.getElementById('page-forum').classList.add('active')
    } else {
      alert(data.msg || '发布失败')
    }
  })
}

// ═══════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════
function formatTime(ts) {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  if (min < 1440) return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function escapeHtml(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

// ═══════════════════════════════════════════════════════════
// 创建论坛
// ═══════════════════════════════════════════════════════════
function showCreateForum() {
  if (!currentLoc) {
    alert('请先授权位置信息')
    return
  }
  document.getElementById('createModal').style.display = 'flex'
  document.getElementById('createName').value = ''
  document.getElementById('createDesc').value = ''
  document.getElementById('createName').focus()
}

function hideCreateForum() {
  document.getElementById('createModal').style.display = 'none'
}

async function createForum() {
  const name = document.getElementById('createName').value.trim()
  const description = document.getElementById('createDesc').value.trim()
  if (!name) return alert('请输入论坛名称')

  const data = await api('/api/forums', {
    method: 'POST',
    body: { name, description, lat: currentLoc.lat, lng: currentLoc.lng, geohash: currentGeohash }
  })

  if (data.code === 0) {
    hideCreateForum()
    await loadForums()
  } else {
    alert(data.msg || '创建失败')
  }
}

// ═══════════════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════════════
async function init() {
  document.getElementById('locationStatus').innerHTML = '<span class="location-dot"></span>正在定位...'

  await login()

  try {
    const loc = await refreshLocation()
    currentLoc = loc
    currentGeohash = loc.geohash
    document.getElementById('locationStatus').innerHTML = '<span class="location-dot"></span>当前位置附近'
    await api('/api/presence', { method: 'PUT', body: { lat: loc.lat, lng: loc.lng, geohash: loc.geohash } })
    await loadForums()
    startPolling()
  } catch (e) {
    if (e.message === 'LOCATION_DENIED') {
      document.getElementById('locationStatus').innerHTML = '<span class="location-dot error"></span>位置权限被拒绝 — 请在浏览器设置中允许定位'
      document.getElementById('homeLoading').innerHTML = '<p>需要位置权限才能搜索附近论坛</p><button class="retry-btn" onclick="init()">重试</button>'
    } else {
      document.getElementById('locationStatus').innerHTML = '<span class="location-dot error"></span>定位失败: ' + e.message
    }
  }
}

init()
