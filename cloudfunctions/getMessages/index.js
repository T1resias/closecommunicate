const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { forumId, lastId, limit = 20 } = event

  if (!forumId) {
    return { code: 1, msg: '缺少论坛ID' }
  }

  let query = db.collection('messages')
    .where({ forumId })
    .orderBy('createTime', 'desc')
    .limit(Math.min(limit, 50))

  // 游标分页
  if (lastId) {
    const lastMsg = await db.collection('messages').doc(lastId).get()
    if (lastMsg.data) {
      query = query.where({
        forumId,
        createTime: _.lt(lastMsg.data.createTime)
      })
    }
  }

  const res = await query.get()

  return {
    code: 0,
    messages: res.data.reverse(),
    hasMore: res.data.length >= limit
  }
}
