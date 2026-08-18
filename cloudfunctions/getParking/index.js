// 获取停车场数据云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { type = 'all' } = event

  try {
    const res = await db.collection('parking_lots').get()

    // 过滤数据
    let parkingLots = res.data

    if (type === 'available') {
      parkingLots = parkingLots.filter(lot => lot.available > 0)
    } else if (type === 'nearby') {
      const { lat, lon, radius = 2000 } = event

      if (lat && lon) {
        // 计算距离并筛选
        parkingLots = parkingLots.filter(lot => {
          const distance = calculateDistance(lat, lon, lot.latitude, lot.longitude)
          return distance <= radius
        }).map(lot => ({
          ...lot,
          distance: calculateDistance(lat, lon, lot.latitude, lot.longitude)
        })).sort((a, b) => a.distance - b.distance)
      }
    }

    return {
      success: true,
      data: parkingLots
    }
  } catch (error) {
    console.error('获取停车场数据失败:', error)
    return {
      success: false,
      error: error.message || '获取停车场数据失败'
    }
  }
}

// Haversine公式计算两点间距离（米）
function calculateDistance(lat1, lon1, lat2, lon2) {
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

function toRad(degrees) {
  return degrees * (Math.PI / 180)
}
