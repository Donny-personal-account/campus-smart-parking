// 工具函数库

/**
 * 格式化日期时间
 */
function formatTime(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`
}

/**
 * 数字格式化（补零）
 */
function formatNumber(n) {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 距离计算（Haversine公式）
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371 // 地球半径（千米）
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c // 千米
  return distance
}

/**
 * 判断点是否在多边形内
 */
function isPointInPolygon(point, polygon) {
  let x = point.longitude, y = point.latitude
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].longitude, yi = polygon[i].latitude
    let xj = polygon[j].longitude, yj = polygon[j].latitude
    
    let intersect = ((yi > y) != (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * 计算预估时间
 */
function estimateTime(distance, speed = 50) {
  // distance: 米, speed: 米/分钟 (默认步行速度)
  return Math.ceil(distance / speed)
}

/**
 * 格式化距离
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}米`
  } else {
    return `${(meters / 1000).toFixed(2)}公里`
  }
}

/**
 * 显示Toast
 */
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({
    title,
    icon,
    duration
  })
}

/**
 * 显示Loading
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏Loading
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * 显示Modal
 */
function showModal(title, content) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm)
      }
    })
  })
}

module.exports = {
  formatTime,
  formatNumber,
  getDistance,
  isPointInPolygon,
  estimateTime,
  formatDistance,
  showToast,
  showLoading,
  hideLoading,
  showModal
}
