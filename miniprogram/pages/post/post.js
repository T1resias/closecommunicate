const api = require('../../utils/api')

Page({
  data: {
    forumId: '',
    forumName: '',
    content: ''
  },

  onLoad(options) {
    this.setData({
      forumId: options.forumId || '',
      forumName: decodeURIComponent(options.name || '')
    })
  },

  onInput(e) {
    this.setData({ content: e.detail.value })
  },

  async onSubmit() {
    const content = this.data.content.trim()
    if (!content) return

    wx.showLoading({ title: '发布中' })
    const { result } = await api.sendMessage(this.data.forumId, content)
    wx.hideLoading()

    if (result.code === 0) {
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
    } else {
      wx.showToast({ title: result.msg || '发布失败', icon: 'none' })
    }
  }
})
