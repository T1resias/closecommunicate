const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, geohash, lat, lng } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  switch (action) {
    case 'login':
      return handleLogin(openid)
    case 'update':
      return updatePresence(openid, geohash, lat, lng)
    case 'leave':
      return leaveForums(openid)
    default:
      return { code: 1, msg: '未知操作' }
  }
}

async function handleLogin(openid) {
  const res = await db.collection('users').where({ openid }).get()
  if (res.data.length === 0) {
    await db.collection('users').add({
      data: {
        openid,
        createTime: Date.now(),
        nickname: '用户' + openid.slice(-6)
      }
    })
  }
  return { code: 0, userId: openid }
}

async function updatePresence(openid, geohash, lat, lng) {
  const now = Date.now()
  const presenceData = {
    openid,
    geohash,
    location: { lat, lng },
    lastUpdate: now
  }

  const res = await db.collection('user_presence').where({ openid }).get()

  if (res.data.length === 0) {
    await db.collection('user_presence').add({ data: presenceData })
  } else {
    await db.collection('user_presence').doc(res.data[0]._id).update({
      data: presenceData
    })
  }

  return { code: 0, geohash }
}

async function leaveForums(openid) {
  await db.collection('user_presence').where({ openid }).remove()
  return { code: 0 }
}
