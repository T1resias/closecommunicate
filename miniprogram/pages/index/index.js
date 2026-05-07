const api = require('../../utils/api')
const locationService = require('../../utils/location')
const app = getApp()

Page({
  data: {
    forums: [],
    loading: true,
    locationError: false,
    currentAddress: '',
    error: ''
  },

  onLoad() {
    this.startLocationTracking()
  },

  onShow() {
    if (app.globalData.currentGeohash) {
      this.loadForums()
    }
  },

  onUnload() {
    locationService.stopPolling()
  },

  onPullDownRefresh() {
    this.loadForums().then(() => wx.stopPullDownRefresh())
  },

  async startLocationTracking() {
    this.setData({ loading: true, locationError: false })
    try {
      const location = await app.refreshLocation()
      this.setData({ locationError: false, currentAddress: '' })
      this.loadForums()
      // 前台轮询位置
      locationService.startPolling(async (loc) => {
        const oldHash = app.globalData.currentGeohash
        app.globalData.currentLocation = loc
        app.globalData.currentGeohash = loc.geohash
        if (oldHash !== loc.geohash) {
          await api.updatePresence('update', {
            geohash: loc.geohash,
            lat: loc.lat,
            lng: loc.lng
          })
          this.loadForums()
        }
      }, 30000)
    } catch (err) {
      if (err.message === 'LOCATION_DENIED') {
        this.setData({ locationError: true, loading: false })
      } else {
        this.setData({ error: '位置获取失败，请重试', loading: false })
      }
    }
  },

  async loadForums() {
    const { currentLocation, currentGeohash } = app.globalData
    if (!currentGeohash) return

    this.setData({ loading: true, error: '' })
    try {
      const { result } = await api.getNearbyForums(
        currentLocation.lat,
        currentLocation.lng,
        currentGeohash
      )
      if (result.code === 0) {
        // 分离父论坛和子论坛
        const parents = result.forums.filter(f => !f.geohash || true)
        this.setData({ forums: result.forums, loading: false })
        app.globalData.activeForums = result.forums.map(f => f._id)
      } else {
        this.setData({ error: result.msg || '加载失败', loading: false })
      }
    } catch (err) {
      this.setData({ error: '网络异常，请重试', loading: false })
    }
  },

  onRetryLocation() {
    this.startLocationTracking()
  },

  onForumTap(e) {
    const forum = e.detail.forum || e.currentTarget.dataset.forum
    wx.navigateTo({
      url: `/pages/forum/forum?forumId=${forum._id}&name=${encodeURIComponent(forum.name)}`
    })
  }
})
