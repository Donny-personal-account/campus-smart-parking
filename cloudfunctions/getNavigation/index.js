// 导航云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { originLat, originLon, destLat, destLon, mode = 'driving' } = event
  const wxContext = cloud.getWXContext()

  try {
    // 使用百度地图API进行路径规划
    const BAIDU_MAP_AK = 'SNzw3eNWDMWCLAfesFoTYlONYSYpdKxU'

    const url = `https://api.map.baidu.com/direction/v2/${mode}?origin=${originLon},${originLat}&destination=${destLon},${destLat}&ak=${BAIDU_MAP_AK}&output=json`

    const res = await new Promise((resolve, reject) => {
      const https = require('https')
      https.get(url, (response) => {
        let data = ''

        response.on('data', (chunk) => {
          data += chunk
        })

        response.on('end', () => {
          resolve(JSON.parse(data))
        })
      }).on('error', reject)
    })

    if (res.status !== 0) {
      return {
        success: false,
        error: '路径规划失败'
      }
    }

    const result = res.result
    const distance = result.routes[0].distance
    const duration = result.routes[0].duration
    const steps = result.routes[0].steps

    // 构造导航URL
    const navigationUrl = `baidumap://map/direction?origin=${originLat},${originLon}&destination=${destLat},${destLon}&mode=driving&src=webapp.recover`

    return {
      success: true,
      data: {
        distance: distance,
        duration: duration,
        steps: steps,
        navigation_url: navigationUrl
      }
    }
  } catch (error) {
    console.error('路径规划失败:', error)
    return {
      success: false,
      error: error.message || '路径规划失败'
    }
  }
}
