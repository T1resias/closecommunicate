const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const BITS = [16, 8, 4, 2, 1]

function encode(lat, lng, precision = 8) {
  let minLat = -90, maxLat = 90
  let minLng = -180, maxLng = 180
  let hash = ''
  let bit = 0
  let charIndex = 0
  let isEven = true

  while (hash.length < precision) {
    if (isEven) {
      const mid = (minLng + maxLng) / 2
      if (lng >= mid) {
        charIndex |= BITS[bit]
        minLng = mid
      } else {
        maxLng = mid
      }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat >= mid) {
        charIndex |= BITS[bit]
        minLat = mid
      } else {
        maxLat = mid
      }
    }

    isEven = !isEven
    bit++
    if (bit === 5) {
      hash += BASE32[charIndex]
      bit = 0
      charIndex = 0
    }
  }
  return hash
}

function decode(hash) {
  let minLat = -90, maxLat = 90
  let minLng = -180, maxLng = 180
  let isEven = true

  for (let i = 0; i < hash.length; i++) {
    const charIndex = BASE32.indexOf(hash[i])
    for (let j = 4; j >= 0; j--) {
      const bit = (charIndex >> j) & 1
      if (isEven) {
        const mid = (minLng + maxLng) / 2
        if (bit) minLng = mid
        else maxLng = mid
      } else {
        const mid = (minLat + maxLat) / 2
        if (bit) minLat = mid
        else maxLat = mid
      }
      isEven = !isEven
    }
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
    error: {
      lat: (maxLat - minLat) / 2,
      lng: (maxLng - minLng) / 2
    }
  }
}

const NEIGHBORS = {
  n: ['p0r21436x8zb9dcf5h7kjnmqesgutwvy', 'bc01fg45238967deuvhjyznpkmstqrwx'],
  s: ['14365h7k9dcfesgujnmqp0r2twvyx8zb', '238967debc01fg45kmstqrwxuvhjyznp'],
  e: ['bc01fg45238967deuvhjyznpkmstqrwx', 'p0r21436x8zb9dcf5h7kjnmqesgutwvy'],
  w: ['238967debc01fg45kmstqrwxuvhjyznp', '14365h7k9dcfesgujnmqp0r2twvyx8zb']
}

const BORDERS = {
  n: ['prxz', 'bcfguvyz'],
  s: ['028b', '0145hjnp'],
  e: ['bcfguvyz', 'prxz'],
  w: ['0145hjnp', '028b']
}

function getNeighbor(hash, direction) {
  const lastChar = hash[hash.length - 1]
  const type = hash.length % 2
  const neighbors = NEIGHBORS[direction]
  const borders = BORDERS[direction]

  if (borders[type].indexOf(lastChar) !== -1) {
    const parent = getNeighbor(hash.slice(0, -1), direction)
    if (parent) return parent + BASE32[neighbors[type].indexOf(lastChar)]
    return null
  }
  return hash.slice(0, -1) + BASE32[neighbors[type].indexOf(lastChar)]
}

function getNeighbors(hash) {
  return {
    n: getNeighbor(hash, 'n'),
    s: getNeighbor(hash, 's'),
    e: getNeighbor(hash, 'e'),
    w: getNeighbor(hash, 'w'),
    ne: getNeighbor(getNeighbor(hash, 'n'), 'e'),
    nw: getNeighbor(getNeighbor(hash, 'n'), 'w'),
    se: getNeighbor(getNeighbor(hash, 's'), 'e'),
    sw: getNeighbor(getNeighbor(hash, 's'), 'w')
  }
}

function getParent(hash) {
  return hash ? hash.slice(0, -1) : ''
}

function getChildren(hash) {
  const children = []
  for (let i = 0; i < BASE32.length; i++) {
    children.push(hash + BASE32[i])
  }
  return children
}

function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 根据范围(米)返回合适的 geohash 精度
 * 精度6=±610m, 精度7=±76m, 精度8=±19m
 */
function precisionForRange(rangeMeters) {
  if (rangeMeters <= 20) return 8
  if (rangeMeters <= 80) return 7
  if (rangeMeters <= 600) return 6
  if (rangeMeters <= 2500) return 5
  return 4
}

module.exports = {
  encode,
  decode,
  getNeighbor,
  getNeighbors,
  getParent,
  getChildren,
  distance,
  precisionForRange
}
