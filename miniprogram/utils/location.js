const geohash = require('./geohash')

const FALLBACK_PRECISION = 8
let pollingTimer = null

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success(res) {
        const { latitude, longitude } = res
        resolve({
          lat: latitude,
          lng: longitude,
          geohash: geohash.encode(latitude, longitude, FALLBACK_PRECISION),
          timestamp: Date.now()
        })
      },
      fail(err) {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          reject(new Error('LOCATION_DENIED'))
        } else {
          reject(err)
        }
      }
    })
  })
}

/**
 * 获取周边 WiFi 列表，用于辅助定位
 * 小程序需要先调用 startWifi 初始化
 */
function getWifiList() {
  return new Promise((resolve, reject) => {
    wx.startWifi({
      success() {
        wx.getWifiList({
          success(res) {
            resolve(res.wifiList || [])
          },
          fail(err) {
            reject(err)
          }
        })
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

function onLocationChange(callback) {
  wx.onLocationChange(res => {
    const { latitude, longitude } = res
    callback({
      lat: latitude,
      lng: longitude,
      geohash: geohash.encode(latitude, longitude, FALLBACK_PRECISION),
      timestamp: Date.now()
    })
  })
}

function startLocationUpdate() {
  return new Promise((resolve, reject) => {
    wx.startLocationUpdate({
      success: resolve,
      fail: reject
    })
  })
}

function stopLocationUpdate() {
  wx.stopLocationUpdate()
}

/**
 * 启动位置轮询（降级方案，前台使用）
 * @param {Function} callback 位置变化回调
 * @param {number} interval 轮询间隔(ms)，默认30秒
 */
function startPolling(callback, interval = 30000) {
  stopPolling()
  const poll = async () => {
    try {
      const location = await getCurrentLocation()
      callback(location)
    } catch (err) {
      console.error('位置轮询失败:', err)
    }
    pollingTimer = setTimeout(poll, interval)
  }
  poll()
}

function stopPolling() {
  if (pollingTimer) {
    clearTimeout(pollingTimer)
    pollingTimer = null
  }
}

module.exports = {
  getCurrentLocation,
  getWifiList,
  onLocationChange,
  startLocationUpdate,
  stopLocationUpdate,
  startPolling,
  stopPolling
}
