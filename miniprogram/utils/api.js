const app = getApp()

function callFunction(name, data = {}) {
  return wx.cloud.callFunction({ name, data })
}

function getNearbyForums(lat, lng, geohash) {
  return callFunction('getNearbyForums', { lat, lng, geohash })
}

function getMessages(forumId, lastId, limit = 20) {
  return callFunction('getMessages', { forumId, lastId, limit })
}

function sendMessage(forumId, content, type = 'text') {
  return callFunction('sendMessage', { forumId, content, type })
}

function getPoiInfo(lat, lng) {
  return callFunction('getPoiInfo', { lat, lng })
}

function updatePresence(action, data = {}) {
  return callFunction('userPresence', { action, ...data })
}

module.exports = {
  getNearbyForums,
  getMessages,
  sendMessage,
  getPoiInfo,
  updatePresence
}
