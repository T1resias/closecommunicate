const express = require('express')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const PORT = process.env.PORT || 3456
const MAP_KEY = 'VH3BZ-AWAK4-SZ2UH-K2OLO-QQT4F-QFB7Z'
const PRESENCE_TTL = 5 * 60 * 1000
const DATA_FILE = path.join(__dirname, 'data.json')

// ─── 简易 JSON 数据库 ──────────────────────────────────────
let DB = { nextId: 1, forums: [], messages: [], presences: [] }

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2))
}

function loadDB() {
  if (fs.existsSync(DATA_FILE)) {
    try { DB = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) } catch (e) { initSampleData() }
  } else {
    initSampleData()
  }
}

function initSampleData() {
  DB.forums = []
  DB.messages = []
  DB.presences = []
  DB.nextId = 1
  // 插入示例论坛
  const samples = [
    { name: '万达广场', type: 'mall', geohash: 'wx4g0ec', lat: 39.9042, lng: 116.4074, description: '大型综合购物中心', address: 'XX路XX号', member_count: 0, last_active_time: Date.now() },
    { name: '阳光小区', type: 'community', geohash: 'wx4g0ec', lat: 39.9042, lng: 116.4074, description: '温馨宜居社区', address: 'XX路XX号', member_count: 0, last_active_time: Date.now() }
  ]
  samples.forEach(f => {
    DB.forums.push({ id: DB.nextId++, ...f })
  })
  saveDB()
  console.log('示例数据已初始化')
}

loadDB()

// ─── Geohash ───────────────────────────────────────────────
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const BITS = [16, 8, 4, 2, 1]

function geohashEncode(lat, lng, precision = 8) {
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

// ─── SSE 管理 ──────────────────────────────────────────────
const sseClients = new Map()

function broadcastMessage(forumId, msg) {
  const clients = sseClients.get(forumId)
  if (!clients) return
  const data = JSON.stringify(msg)
  clients.forEach(c => {
    try { c.res.write(`data: ${data}\n\n`) } catch (_) {}
  })
}

// ─── Express ───────────────────────────────────────────────
const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

function getUserId(req) {
  return req.headers['x-user-id'] || 'anon'
}

// ─── 匿名登录 ──────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const userId = 'u_' + crypto.randomBytes(8).toString('hex')
  const nickname = '用户' + userId.slice(-6)
  // 清理旧记录
  DB.presences = DB.presences.filter(p => p.user_id !== userId)
  DB.presences.push({ user_id: userId, nickname, geohash: '', lat: 0, lng: 0, last_update: 0 })
  saveDB()
  res.json({ code: 0, userId, nickname })
})

// ─── 更新位置 ──────────────────────────────────────────────
app.put('/api/presence', (req, res) => {
  const userId = getUserId(req)
  const { lat, lng, geohash } = req.body
  if (!lat || !lng) return res.json({ code: 1, msg: '缺少位置' })

  const gh = geohash || geohashEncode(lat, lng)
  const idx = DB.presences.findIndex(p => p.user_id === userId)
  const data = { user_id: userId, geohash: gh, lat, lng, last_update: Date.now() }
  if (idx >= 0) {
    data.nickname = DB.presences[idx].nickname
    DB.presences[idx] = data
  } else {
    data.nickname = '用户' + userId.slice(-6)
    DB.presences.push(data)
  }
  saveDB()
  res.json({ code: 0, geohash: gh })
})

// ─── 获取附近论坛 ──────────────────────────────────────────
app.get('/api/forums', (req, res) => {
  const { geohash } = req.query
  if (!geohash) return res.json({ code: 1, forums: [] })

  const prefixes = []
  for (let i = geohash.length; i >= 3; i--) prefixes.push(geohash.slice(0, i))

  let forums = DB.forums.filter(f => prefixes.some(p => f.geohash.startsWith(p)))
  forums.sort((a, b) => b.geohash.length - a.geohash.length)

  // 计算在线人数
  forums.forEach(f => {
    f.member_count = DB.presences.filter(p => p.geohash && f.geohash.startsWith(p.geohash.slice(0, 3))).length
  })

  // 构建层级
  forums.forEach(f => {
    f.children = forums.filter(c =>
      c.id !== f.id && c.geohash.startsWith(f.geohash) && c.geohash.length > f.geohash.length
    )
    f.isParent = f.children.length > 0
  })

  res.json({ code: 0, forums })
})

// ─── 获取消息 ──────────────────────────────────────────────
app.get('/api/messages/:forumId', (req, res) => {
  const forumId = parseInt(req.params.forumId)
  const { lastId, limit = 20 } = req.query

  let msgs = DB.messages.filter(m => m.forum_id === forumId)
  msgs.sort((a, b) => b.create_time - a.create_time)

  if (lastId) {
    const lastMsg = msgs.find(m => m.id === parseInt(lastId))
    if (lastMsg) msgs = msgs.filter(m => m.create_time < lastMsg.create_time)
  }

  const page = msgs.slice(0, Math.min(limit, 50)).reverse()
  res.json({ code: 0, messages: page, hasMore: msgs.length > limit })
})

// ─── 发送消息 ──────────────────────────────────────────────
app.post('/api/messages', (req, res) => {
  const userId = getUserId(req)
  const { forumId, content, type = 'text' } = req.body
  if (!forumId || !content) return res.json({ code: 1, msg: '缺少参数' })
  if (content.length > 1000) return res.json({ code: 2, msg: '内容过长' })

  const presence = DB.presences.find(p => p.user_id === userId)
  if (!presence) return res.json({ code: 3, msg: '请先授权位置' })
  if (Date.now() - presence.last_update > PRESENCE_TTL) return res.json({ code: 4, msg: '位置已过期' })

  const msg = {
    id: DB.nextId++,
    forum_id: parseInt(forumId),
    user_id: userId,
    nickname: presence.nickname || '用户' + userId.slice(-6),
    content,
    type,
    create_time: Date.now()
  }
  DB.messages.push(msg)

  // 更新论坛活跃时间
  const forum = DB.forums.find(f => f.id === parseInt(forumId))
  if (forum) forum.last_active_time = msg.create_time

  saveDB()
  broadcastMessage(parseInt(forumId), msg)
  res.json({ code: 0, msgId: msg.id })
})

// ─── POI 信息 ──────────────────────────────────────────────
app.get('/api/poi', async (req, res) => {
  const { lat, lng } = req.query
  if (!lat || !lng) return res.json({ code: 1, poi: null })

  const la = parseFloat(lat), ln = parseFloat(lng)
  const forum = DB.forums.find(f =>
    f.lat >= la - 0.01 && f.lat <= la + 0.01 && f.lng >= ln - 0.01 && f.lng <= ln + 0.01
  )
  if (forum) return res.json({ code: 0, poi: { name: forum.name, description: forum.description, type: forum.type, address: forum.address } })

  try {
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${MAP_KEY}&get_poi=1`
    const data = await fetch(url).then(r => r.json())
    if (data.status === 0 && data.result) {
      const addr = data.result.address_component || {}
      const pois = data.result.pois || []
      return res.json({ code: 0, poi: {
        name: addr.street || addr.district || '附近',
        description: pois.length > 0 ? pois[0].title : '',
        type: 'other',
        address: data.result.address || ''
      }})
    }
    res.json({ code: 0, poi: null })
  } catch (e) {
    res.json({ code: 3, msg: e.message, poi: null })
  }
})

// ─── SSE 实时 ──────────────────────────────────────────────
app.get('/api/stream/:forumId', (req, res) => {
  const forumId = parseInt(req.params.forumId)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  })
  res.write('data: {"type":"connected"}\n\n')

  if (!sseClients.has(forumId)) sseClients.set(forumId, new Set())
  const client = { res, userId: getUserId(req) }
  sseClients.get(forumId).add(client)

  req.on('close', () => {
    sseClients.get(forumId)?.delete(client)
    if (sseClients.get(forumId)?.size === 0) sseClients.delete(forumId)
  })
})

// ─── 定时清理 ──────────────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - PRESENCE_TTL
  DB.presences = DB.presences.filter(p => p.last_update > cutoff || p.last_update === 0)
  saveDB()
}, 10 * 60 * 1000)

// ─── 启动 ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`)
})
