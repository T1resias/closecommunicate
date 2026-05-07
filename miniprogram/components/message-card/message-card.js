Component({
  properties: {
    msg: {
      type: Object,
      value: {}
    },
    isMine: {
      type: Boolean,
      value: false
    }
  },

  observers: {
    'msg.createTime': function(time) {
      if (!time) return
      const diff = Date.now() - time
      const minutes = Math.floor(diff / 60000)
      let text = ''
      if (minutes < 1) text = '刚刚'
      else if (minutes < 60) text = `${minutes}分钟前`
      else if (minutes < 1440) {
        const d = new Date(time)
        text = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
      } else {
        const d = new Date(time)
        text = `${d.getMonth() + 1}/${d.getDate()}`
      }
      this.setData({ timeText: text })
    }
  },

  data: {
    timeText: ''
  }
})
