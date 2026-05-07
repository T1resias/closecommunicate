const TYPE_TEXT = {
  mall: '商场',
  community: '小区',
  school: '学校',
  office: '写字楼',
  scenic: '景区',
  other: '附近'
}

Component({
  properties: {
    forum: {
      type: Object,
      value: {}
    },
    child: {
      type: Boolean,
      value: false
    }
  },

  computed: {},

  observers: {
    'forum.type': function(type) {
      this.setData({ typeText: TYPE_TEXT[type] || '附近' })
    },
    'forum.lastActiveTime': function(time) {
      if (!time) return
      const diff = Date.now() - time
      const minutes = Math.floor(diff / 60000)
      let text = ''
      if (minutes < 1) text = '刚刚'
      else if (minutes < 60) text = `${minutes}分钟前`
      else if (minutes < 1440) text = `${Math.floor(minutes / 60)}小时前`
      else text = `${Math.floor(minutes / 1440)}天前`
      this.setData({ lastActive: text })
    }
  },

  data: {
    typeText: '',
    lastActive: ''
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { forum: this.data.forum })
    }
  }
})
