const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 初始化数据库集合和索引
 * 在云开发控制台上传并运行一次即可
 */
exports.main = async () => {
  const results = []

  // 1. 创建 forums 集合
  try {
    await db.createCollection('forums')
    results.push('forums 集合创建成功')
  } catch (e) {
    results.push('forums: ' + (e.errCode === -502005 ? '已存在' : e.message))
  }

  // forums 索引
  try { await db.collection('forums').createIndex({ geohash: 1 }) } catch (e) {}
  try { await db.collection('forums').createIndex({ type: 1 }) } catch (e) {}

  // 2. 创建 messages 集合
  try {
    await db.createCollection('messages')
    results.push('messages 集合创建成功')
  } catch (e) {
    results.push('messages: ' + (e.errCode === -502005 ? '已存在' : e.message))
  }

  // messages 索引
  try { await db.collection('messages').createIndex({ forumId: 1, createTime: -1 }) } catch (e) {}

  // 3. 创建 user_presence 集合
  try {
    await db.createCollection('user_presence')
    results.push('user_presence 集合创建成功')
  } catch (e) {
    results.push('user_presence: ' + (e.errCode === -502005 ? '已存在' : e.message))
  }

  try { await db.collection('user_presence').createIndex({ openid: 1 }) } catch (e) {}

  // 4. 创建 users 集合
  try {
    await db.createCollection('users')
    results.push('users 集合创建成功')
  } catch (e) {
    results.push('users: ' + (e.errCode === -502005 ? '已存在' : e.message))
  }

  try { await db.collection('users').createIndex({ openid: 1 }) } catch (e) {}

  // 5. 插入示例论坛数据
  const sampleForums = [
    {
      name: '万达广场',
      type: 'mall',
      geohash: 'wx4g0ec',
      location: { lat: 39.9042, lng: 116.4074 },
      description: '大型综合购物中心，集购物、餐饮、娱乐于一体',
      address: 'XX路XX号',
      memberCount: 0,
      lastActiveTime: Date.now()
    },
    {
      name: '阳光小区',
      type: 'community',
      geohash: 'wx4g0ec',
      location: { lat: 39.9042, lng: 116.4074 },
      description: '温馨宜居社区，绿化率高，邻里和睦',
      address: 'XX路XX号',
      memberCount: 0,
      lastActiveTime: Date.now()
    }
  ]
  for (const f of sampleForums) {
    await db.collection('forums').add({ data: f })
  }
  results.push('示例论坛数据插入完成')

  return { results }
}
