const locationService = require('./utils/location')

App({
  globalData: {
    userInfo: null,
    userId: null,
    currentLocation: null,
    currentGeohash: null,
    activeForums: []
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'cloud1-d4gww5w3f0f1c2576',
      traceUser: true
    })
    this.initUser()
  },

  async initUser() {
    const { result } = await wx.cloud.callFunction({
      name: 'userPresence',
      data: { action: 'login' }
    })
    if (result) {
      this.globalData.userId = result.userId
    }
  },

  async refreshLocation() {
    try {
      const location = await locationService.getCurrentLocation()
      this.globalData.currentLocation = location
      this.globalData.currentGeohash = location.geohash
      return location
    } catch (err) {
      console.error('获取位置失败:', err)
      throw err
    }
  }
})
