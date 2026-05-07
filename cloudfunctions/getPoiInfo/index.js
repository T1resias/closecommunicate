const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(new Error('JSON解析失败')) }
      })
    }).on('error', reject)
  })
}

exports.main = async (event) => {
  const { lat, lng } = event

  if (!lat || !lng) {
    return { code: 1, msg: '缺少坐标', poi: null }
  }

  const db = cloud.database()

  // 先从本地 forums 查找
  try {
    const forumRes = await db.collection('forums')
      .where({
        'location.lat': db.command.gte(lat - 0.01).and(db.command.lte(lat + 0.01)),
        'location.lng': db.command.gte(lng - 0.01).and(db.command.lte(lng + 0.01))
      })
      .limit(1)
      .get()

    if (forumRes.data.length > 0) {
      const f = forumRes.data[0]
      return {
        code: 0,
        poi: {
          name: f.name,
          description: f.description || '',
          type: f.type || 'other',
          address: f.address || ''
        }
      }
    }
  } catch (e) {
    console.error('本地POI查询失败:', e)
  }

  // 调用腾讯地图逆地理编码
  const mapKey = 'VH3BZ-AWAK4-SZ2UH-K2OLO-QQT4F-QFB7Z'
  if (!mapKey) {
    return { code: 2, msg: '未配置地图密钥', poi: null }
  }

  try {
    const url = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${mapKey}&get_poi=1`
    const data = await httpGet(url)

    if (data.status === 0 && data.result) {
      const addr = data.result.address_component || {}
      const pois = data.result.pois || []
      return {
        code: 0,
        poi: {
          name: addr.street || addr.district || '附近',
          description: pois.length > 0 ? pois[0].title + ' ' + (pois[0]._distance || '') : '',
          type: 'other',
          address: data.result.address || ''
        }
      }
    }
    return { code: 0, poi: null }
  } catch (err) {
    return { code: 3, msg: '获取POI失败: ' + err.message, poi: null }
  }
}
