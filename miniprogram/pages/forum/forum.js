const api = require('../../utils/api')
const geohash = require('../../utils/geohash')
const app = getApp()

const TYPE_MAP = {
  mall: '商场',
  community: '小区',
  school: '学校',
  office: '写字楼',
  scenic: '景区',
  other: '其他'
}

Page({
  data: {
    forumId: '',
    forum: {},
    forumTypeText: '',
    messages: [],
    inputValue: '',
    loading: true,
    hasMore: true,
    userId: '',
    distance: 0
  },

  onLoad(options) {
    const { forumId, name } = options
    this.setData({
      forumId,
      'forum.name': decodeURIComponent(name || ''),
      userId: app.globalData.userId
    })
    this.loadForumInfo()
    this.loadMessages()
    this.setupRealtime()
  },

  onUnload() {
    if (this.watcher) this.watcher.close()
  },

  async loadForumInfo() {
    const { result } = await api.getPoiInfo(
      app.globalData.currentLocation?.lat,
      app.globalData.currentLocation?.lng
    )
    if (result && result.poi) {
      this.setData({
        'forum.description': result.poi.description || this.data.forum.description,
        'forum.type': result.poi.type || this.data.forum.type,
        'forum.address': result.poi.address || this.data.forum.address,
        forumTypeText: TYPE_MAP[result.poi.type] || '附近地点'
      })
    }
    // 计算距离
    const loc = app.globalData.currentLocation
    if (loc && this.data.forum.location) {
      this.setData({
        distance: Math.round(geohash.distance(
          loc.lat, loc.lng,
          this.data.forum.location.lat, this.data.forum.location.lng
        ))
      })
    }
  },

  async loadMessages() {
    this.setData({ loading: true })
    const lastId = this.data.messages.length > 0
      ? this.data.messages[0]._id
      : null

    const { result } = await api.getMessages(this.data.forumId, lastId)
    if (result.code === 0) {
      this.setData({
        messages: result.messages,
        loading: false,
        hasMore: result.hasMore
      })
    }
  },

  setupRealtime() {
    // 云数据库实时监听新消息
    const db = wx.cloud.database()
    this.watcher = db.collection('messages')
      .where({ forumId: this.data.forumId })
      .orderBy('createTime', 'desc')
      .limit(5)
      .watch({
        onChange: snapshot => {
          if (snapshot.type === 'init') return
          snapshot.docs.forEach(doc => {
            const exists = this.data.messages.find(m => m._id === doc._id)
            if (!exists) {
              this.setData({
                messages: [...this.data.messages, doc]
              })
              wx.pageScrollTo({ scrollTop: 99999, duration: 200 })
            }
          })
        },
        onError: () => {}
      })
  },

  onSend() {
    const content = this.data.inputValue.trim()
    if (!content) return

    api.sendMessage(this.data.forumId, content).then(({ result }) => {
      if (result.code === 0) {
        this.setData({ inputValue: '' })
      } else {
        wx.showToast({ title: result.msg || '发送失败', icon: 'none' })
      }
    })
  }
})
