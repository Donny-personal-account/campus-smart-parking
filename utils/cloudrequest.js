// CloudBase 云函数调用封装
const db = wx.cloud.database()

/**
 * 调用云函数
 */
function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success: (res) => {
        resolve(res.result)
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * 获取停车场数据
 */
function getParking(type = 'all', lat, lon, radius) {
  return callFunction('getParking', {
    type,
    lat,
    lon,
    radius
  })
}

/**
 * 获取导航路径
 */
function getNavigation(originLat, originLon, destLat, destLon, mode) {
  return callFunction('getNavigation', {
    originLat,
    originLon,
    destLat,
    destLon,
    mode
  })
}

module.exports = {
  callFunction,
  getParking,
  getNavigation
}
