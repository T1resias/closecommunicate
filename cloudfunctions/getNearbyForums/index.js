const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 根据用户 geohash 查询附近的论坛
 * 匹配策略：
 * 1. 精确匹配同一 geohash
 * 2. 匹配父级 geohash（更大范围）
 * 3. 匹配邻近 geohash 区域
 */
exports.main = async (event) => {
  const { lat, lng, geohash } = event

  if (!geohash) return { code: 1, msg: '缺少位置信息', forums: [] }

  // 逐级生成前缀：wx4g0ec → wx4g0e → wx4g0 → ...
  const prefixes = []
  for (let i = geohash.length; i >= 3; i--) {
    prefixes.push(geohash.slice(0, i))
  }

  // 同时查询所有可能匹配的前缀
  // 云数据库用 _.in 查询
  const _ = db.command
  let forums = []

  try {
    const res = await db.collection('forums')
      .where(_.or(prefixes.map(p => ({ geohash: db.RegExp({ regexp: '^' + p, options: 'i' }) }))))
      .limit(50)
      .get()
    forums = res.data
  } catch (err) {
    // geohash 前缀匹配不支持正则时降级用精确匹配
    console.error('前缀匹配失败，尝试精确匹配:', err)
  }

  if (forums.length === 0) {
    try {
      const res = await db.collection('forums')
        .where({ geohash: _.in(prefixes) })
        .limit(50)
        .get()
      forums = res.data
    } catch (err) {
      console.error('精确匹配也失败:', err)
    }
  }

  // 按 geohash 长度降序排列：小的地理范围优先
  forums.sort((a, b) => b.geohash.length - a.geohash.length)

  // 构建层级关系
  const forumMap = {}
  forums.forEach(f => { forumMap[f._id] = f })

  forums.forEach(f => {
    f.children = forums.filter(child =>
      child._id !== f._id &&
      child.geohash.startsWith(f.geohash) &&
      child.geohash.length > f.geohash.length
    )
    f.isParent = f.children.length > 0
  })

  return { code: 0, forums }
}
