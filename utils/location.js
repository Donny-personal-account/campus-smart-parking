// utils/location.js - 定位精度优化工具

/**
 * 获取精确位置（多次采样 + 卡尔曼滤波 + 参考点校正）
 * @param {number} times - 采样次数，默认 5 次
 * @param {number} interval - 采样间隔，默认 800 毫秒
 * @returns {Promise<Object>} 精确位置信息
 */
const getAccurateLocation = async (times = 5, interval = 800) => {
  const locations = []

  for (let i = 0; i < times; i++) {
    try {
      const location = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          altitude: true,
          isHighAccuracy: true,
          highAccuracyExpireTime: 3000,
          success: resolve,
          fail: reject
        })
      })

      locations.push({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy || 50,
        altitude: location.altitude,
        speed: location.speed,
        timestamp: Date.now()
      })
    } catch (error) {
      console.warn(`第 ${i + 1} 次定位失败:`, error)
    }

    if (i < times - 1) {
      await new Promise(resolve => setTimeout(resolve, interval))
    }
  }

  if (locations.length === 0) {
    throw new Error('定位失败，请检查定位权限')
  }

  // 计算加权平均值（精度越高权重越大）
  let totalWeight = 0
  let weightedLat = 0
  let weightedLon = 0

  locations.forEach(loc => {
    const weight = 1 / (loc.accuracy * loc.accuracy || 1)
    weightedLat += loc.latitude * weight
    weightedLon += loc.longitude * weight
    totalWeight += weight
  })

  const averagedLocation = {
    latitude: weightedLat / totalWeight,
    longitude: weightedLon / totalWeight,
    accuracy: Math.sqrt(1 / totalWeight),
    samples: locations.length,
    rawLocations: locations
  }

  // 卡尔曼滤波
  const kalmanFiltered = applyKalmanFilter(averagedLocation)

  // 参考点校正
  const correctedLocation = applyReferenceCorrection(kalmanFiltered)

  return {
    ...correctedLocation,
    samples: locations.length,
    accuracy: correctedLocation.corrected ? correctedLocation.accuracy * 0.5 : correctedLocation.accuracy
  }
}

/**
 * 卡尔曼滤波器类
 */
class KalmanFilter {
  constructor(R = 1, Q = 1, A = 1, B = 0, C = 1) {
    this.R = R // 测量噪声协方差
    this.Q = Q // 过程噪声协方差
    this.A = A // 状态转移矩阵
    this.B = B // 控制矩阵
    this.C = C // 测量矩阵
    this.cov = NaN // 估计协方差矩阵
    this.x = NaN // 估计值
  }

  filter(measurement) {
    if (isNaN(this.x) || isNaN(this.cov)) {
      this.x = measurement
      this.cov = 1
      return this.x
    }

    // 预测
    const predX = this.A * this.x + this.B * 0
    const predCov = this.A * this.cov * this.A + this.Q

    // 更新
    const K = predCov * this.C / (this.C * predCov * this.C + this.R)
    this.x = predX + K * (measurement - this.C * predX)
    this.cov = predCov - K * this.C * predCov

    return this.x
  }

  reset() {
    this.x = NaN
    this.cov = NaN
  }
}

/**
 * 应用卡尔曼滤波
 */
const applyKalmanFilter = (location) => {
  const kalmanLat = new KalmanFilter(0.01, 0.01)
  const kalmanLon = new KalmanFilter(0.01, 0.01)

  // 先用采样点进行滤波
  let lastLat = location.latitude
  let lastLon = location.longitude

  if (location.rawLocations && location.rawLocations.length > 1) {
    location.rawLocations.forEach((loc, index) => {
      if (index > 0) {
        lastLat = kalmanLat.filter(loc.latitude)
        lastLon = kalmanLon.filter(loc.longitude)
      }
    })
  }

  return {
    ...location,
    latitude: lastLat,
    longitude: lastLon
  }
}

/**
 * 校园参考点配置
 * 建议在实际校园中通过 GPS 测量这些点的准确坐标
 */
const REFERENCE_POINTS = [
  {
    name: '东校门',
    trueLat: 28.1850,
    trueLon: 112.9450
  },
  {
    name: '西校门',
    trueLat: 28.1758,
    trueLon: 112.9575
  },
  {
    name: '西图书馆',
    trueLat: 28.1765,
    trueLon: 112.9450
  },
  {
    name: '东图书馆',
    trueLat: 28.1855,
    trueLon: 112.9325
  }
]

/**
 * 校园中心点（用于判断是否在校园范围内）
 * 中南林业科技大学大致范围
 */
const CAMPUS_CENTER = {
  latitude: 28.132,
  longitude: 112.994
}
const CAMPUS_RADIUS = 1500 // 校园半径（米），约1.5公里覆盖整个校园

/**
 * 检查位置是否在校园范围内
 */
const isWithinCampus = (lat, lon) => {
  const distance = calculateDistance(lat, lon, CAMPUS_CENTER.latitude, CAMPUS_CENTER.longitude)
  return distance < CAMPUS_RADIUS
}

/**
 * 参考点校正（仅在校园范围内生效）
 * 校园外直接返回原始位置，不进行校正
 */
const applyReferenceCorrection = (location) => {
  // 首先检查是否在校园范围内
  if (!isWithinCampus(location.latitude, location.longitude)) {
    // 校园外不进行校正
    return {
      ...location,
      corrected: false,
      campusScope: false  // 标记为校园外
    }
  }

  // 在校园范围内，进行参考点校正
  let nearestPoint = null
  let minDistance = Infinity

  REFERENCE_POINTS.forEach(point => {
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      point.trueLat,
      point.trueLon
    )
    if (distance < minDistance && distance < 500) { // 校园内500米内校正
      minDistance = distance
      nearestPoint = point
    }
  })

  if (nearestPoint && minDistance < 500) {
    // 计算偏移量
    const offsetLat = nearestPoint.trueLat - location.latitude
    const offsetLon = nearestPoint.trueLon - location.longitude

    // 应用校正（距离越近权重越大）
    const weight = 1 - (minDistance / 500)

    return {
      ...location,
      latitude: location.latitude + offsetLat * weight * 0.6,
      longitude: location.longitude + offsetLon * weight * 0.6,
      accuracy: location.accuracy * (1 - weight * 0.3),
      corrected: true,
      referencePoint: nearestPoint.name,
      distanceToRef: minDistance,
      campusScope: true  // 标记为校园内
    }
  }

  return {
    ...location,
    corrected: false,
    campusScope: true  // 标记为校园内但不在校正范围内
  }
}

/**
 * 轨迹平滑器类
 */
class TrajectorySmoother {
  constructor(windowSize = 3) {
    this.windowSize = windowSize
    this.historyLat = []
    this.historyLon = []
  }

  smooth(location) {
    this.historyLat.push(location.latitude)
    this.historyLon.push(location.longitude)

    if (this.historyLat.length > this.windowSize) {
      this.historyLat.shift()
      this.historyLon.shift()
    }

    // 简单移动平均
    if (this.historyLat.length >= 2) {
      const avgLat = this.historyLat.reduce((a, b) => a + b, 0) / this.historyLat.length
      const avgLon = this.historyLon.reduce((a, b) => a + b, 0) / this.historyLon.length

      return {
        ...location,
        latitude: avgLat,
        longitude: avgLon
      }
    }

    return location
  }

  reset() {
    this.historyLat = []
    this.historyLon = []
  }
}

/**
 * 速度过滤器类
 */
class SpeedFilter {
  constructor(maxSpeed = 15) { // 最大速度 15m/s (54km/h)
    this.maxSpeed = maxSpeed
    this.lastLocation = null
    this.lastTime = null
  }

  filter(location, time = Date.now()) {
    if (!this.lastLocation || !this.lastTime) {
      this.lastLocation = location
      this.lastTime = time
      return location
    }

    // 计算距离
    const distance = calculateDistance(
      this.lastLocation.latitude,
      this.lastLocation.longitude,
      location.latitude,
      location.longitude
    )

    // 计算时间差
    const timeDiff = (time - this.lastTime) / 1000 // 秒

    // 计算速度
    const speed = timeDiff > 0 ? distance / timeDiff : 0

    if (speed > this.maxSpeed) {
      // 速度异常，返回上一个位置
      console.warn(`速度异常: ${speed.toFixed(2)}m/s，超过最大值 ${this.maxSpeed}m/s`)
      return this.lastLocation
    }

    this.lastLocation = location
    this.lastTime = time
    return location
  }

  reset() {
    this.lastLocation = null
    this.lastTime = null
  }
}

/**
 * Haversine公式计算两点间距离（单位：米）
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000 // 地球半径（米）
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
           Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
           Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return distance
}

/**
 * 角度转弧度
 */
const toRad = (degrees) => {
  return degrees * (Math.PI / 180)
}

/**
 * GCJ02坐标转BD09LL坐标（微信地图转百度地图）
 * @param {number} gcjLat - GCJ02纬度
 * @param {number} gcjLon - GCJ02经度
 * @returns {Object} BD09LL坐标 {latitude, longitude}
 */
const gcj02ToBd09ll = (gcjLat, gcjLon) => {
  const x_pi = 3.14159265358979324 * 3000.0 / 180.0
  const z = Math.sqrt(gcjLon * gcjLon + gcjLat * gcjLat) + 0.00002 * Math.sin(gcjLat * x_pi)
  const theta = Math.atan2(gcjLat, gcjLon) + 0.000003 * Math.cos(gcjLon * x_pi)

  const bdLon = z * Math.cos(theta) + 0.0065
  const bdLat = z * Math.sin(theta) + 0.006

  return {
    latitude: bdLat,
    longitude: bdLon
  }
}

/**
 * 获取单次位置（用于快速定位）
 */
const getQuickLocation = () => {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      altitude: true,
      isHighAccuracy: true,
      success: resolve,
      fail: (err) => {
        console.error('获取位置失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 检查并请求定位权限
 */
const requestLocationAuth = () => {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => resolve(true),
            fail: (err) => {
              if (err.errMsg.includes('auth deny')) {
                wx.showModal({
                  title: '提示',
                  content: '需要获取您的位置信息才能使用导航功能',
                  confirmText: '去设置',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      wx.openSetting()
                    }
                  }
                })
              }
              reject(err)
            }
          })
        } else {
          resolve(true)
        }
      },
      fail: reject
    })
  })
}

module.exports = {
  getAccurateLocation,
  getQuickLocation,
  requestLocationAuth,
  calculateDistance,
  toRad,
  gcj02ToBd09ll,
  isWithinCampus,
  KalmanFilter,
  TrajectorySmoother,
  SpeedFilter
}
