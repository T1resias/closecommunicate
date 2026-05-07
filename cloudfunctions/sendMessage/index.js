const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { forumId, content, type = 'text' } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!forumId || !content) {
    return { code: 1, msg: '缺少参数' }
  }

  if (content.length > 1000) {
    return { code: 2, msg: '内容过长，最多1000字' }
  }

  // 验证用户是否仍在该论坛的有效范围内
  const userRes = await db.collection('user_presence')
    .where({ openid }).get()

  if (userRes.data.length === 0) {
    return { code: 3, msg: '请先授权位置信息' }
  }

  const now = Date.now()
  const presence = userRes.data[0]
  if (now - presence.lastUpdate > 5 * 60 * 1000) {
    return { code: 4, msg: '位置信息已过期，请刷新' }
  }

  const msg = {
    forumId,
    openid,
    content,
    type,
    createTime: now,
    // 匿名展示：用 openid 后6位作为昵称
    nickname: '用户' + openid.slice(-6)
  }

  const result = await db.collection('messages').add({ data: msg })

  // 更新论坛最后活跃时间
  await db.collection('forums').doc(forumId).update({
    data: { lastActiveTime: now }
  })

  return { code: 0, msgId: result._id }
}
