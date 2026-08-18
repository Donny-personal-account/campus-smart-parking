// pages/navigation/navigation.js
const app = getApp()
const { showLoading, hideLoading, showToast } = require('../../utils/request')
const { getAccurateLocation, requestLocationAuth, SpeedFilter, TrajectorySmoother } = require('../../utils/location')

// 腾讯地图 WebService API Key（https://lbs.qq.com/ 免费申请）
const TENCENT_MAP_KEY = 'HXXBZ-IRBET-SNJXL-LGAPK-TEBU6-VNBG6'

Page({
  data: {
    longitude: 112.994,   // 中南林业科技大学中心经度
    latitude: 28.132,     // 中南林业科技大学中心纬度
    scale: 14,            // 缩放级别，14可以显示整个校园区域
    showLocation: true,
    markers: [],
    polyline: [],
    targetParking: null,  // 兼容旧的停车场导航
    targetPoint: null,     // 新的通用目的地（支持任意地点）
    currentLocation: null,
    currentLocationText: '正在获取位置...',
    routeData: null,
    showRoute: false,
    distanceText: '',
    durationText: '',
    
    // 搜索相关
    destinationText: '',
    showSearchResults: false,
    searchResults: [],
    searchTimer: null
  },

  onLoad() {
    // 直接加载导航页面，不强制登录（游客可浏览地图和搜索）
    this.initNavigation()
  },

  onShow() {
    // 检查是否有目标停车场（兼容旧的导航方式）
    if (app.globalData.targetParking && !this.data.targetPoint) {
      const parking = app.globalData.targetParking
      this.setData({
        targetParking: parking,
        targetPoint: {
          name: parking.name,
          latitude: parking.latitude,
          longitude: parking.longitude,
          address: '停车场'
        }
      })
    }

    this.loadParkingMarkers()
  },

  // 初始化导航
  async initNavigation() {
    // 初始化定位优化器
    this.speedFilter = new SpeedFilter(15) // 最大速度 15m/s
    this.trajectorySmoother = new TrajectorySmoother(3)

    // 请求定位权限
    try {
      await requestLocationAuth()

      showLoading('正在精确定位...')
      // 获取精确位置
      const location = await getAccurateLocation(5, 800)
      hideLoading()

      this.setData({
        currentLocation: location,
        longitude: location.longitude,
        latitude: location.latitude,
        currentLocationText: location.corrected
          ? `已校准（采样${location.samples}次）\n参考点: ${location.referencePoint}`
          : `已定位（采样${location.samples}次）`
      })

      // 加载停车场标记
      this.loadParkingMarkers()
    } catch (error) {
      hideLoading()
      console.error('定位失败:', error)
      this.setData({
        currentLocationText: '获取位置失败'
      })
      showToast('请允许获取位置信息')
    }
  },

  // 重新定位
  async reLocate() {
    try {
      showLoading('正在重新定位...')
      const location = await getAccurateLocation(5, 800)
      hideLoading()

      // 速度过滤
      const filteredLocation = this.speedFilter.filter(location)

      // 轨迹平滑
      const smoothedLocation = this.trajectorySmoother.smooth(filteredLocation)

      this.setData({
        currentLocation: smoothedLocation,
        longitude: smoothedLocation.longitude,
        latitude: smoothedLocation.latitude,
        currentLocationText: smoothedLocation.corrected
          ? `已校准（采样${location.samples}次）\n参考点: ${smoothedLocation.referencePoint}`
          : `已定位（采样${location.samples}次）`
      })

      showToast('定位成功', 'success')
    } catch (error) {
      hideLoading()
      showToast('定位失败，请重试')
    }
  },

  // 加载停车场标记
  async loadParkingMarkers() {
    try {
      let parkingLots = app.globalData.parkingLots

      if (!parkingLots || parkingLots.length === 0) {
        const res = await app.request({
          url: '/map/parking-status',
          method: 'GET'
        })
        if (res.success) {
          parkingLots = res.parking_lots
          app.globalData.parkingLots = parkingLots
        }
      }

      if (parkingLots) {
        const markers = parkingLots.map((lot, index) => ({
          id: index,
          longitude: lot.longitude,
          latitude: lot.latitude,
          title: lot.name,
          iconPath: '/images/parking-marker.png',
          width: 32,
          height: 32,
          callout: {
            content: lot.name,
            color: '#333',
            fontSize: 12,
            borderRadius: 8,
            bgColor: 'rgba(255,255,255,0.95)',
            padding: 8
          }
        }))

        this.setData({ markers })
      }
    } catch (error) {
      console.error('加载标记失败:', error)
    }
  },

  // 标记点击事件（停车场标记）
  onMarkerTap(e) {
    const { markerId } = e.detail
    const parkingLots = app.globalData.parkingLots
    const parkingLot = parkingLots[markerId]

    // 设置为目的地
    this.setData({
      targetParking: parkingLot,
      targetPoint: {
        name: parkingLot.name,
        latitude: parkingLot.latitude,
        longitude: parkingLot.longitude,
        address: '停车场'
      },
      destinationText: parkingLot.name
    })
    
    showToast(`已选择: ${parkingLot.name}`, 'success')
  },

  // ========== 目的地搜索相关方法 ==========

  // 目的地输入事件
  onDestinationInput(e) {
    const keyword = e.detail.value
    this.setData({
      destinationText: keyword,
      showSearchResults: false
    })

    // 防抖搜索
    if (this.searchTimer) {
      clearTimeout(this.searchTimer)
    }

    if (keyword.trim().length > 0) {
      this.searchTimer = setTimeout(() => {
        this.performSearch(keyword)
      }, 300)
    } else {
      this.setData({ searchResults: [] })
    }
  },

  // 执行搜索
  async performSearch(keyword) {
    try {
      let lat = null, lon = null
      if (this.data.currentLocation) {
        lat = this.data.currentLocation.latitude
        lon = this.data.currentLocation.longitude
      }

      const res = await app.request({
        url: '/navigation/search',
        method: 'GET',
        data: {
          keyword: keyword,
          lat: lat,
          lon: lon
        }
      })

      if (res.success) {
        this.setData({
          searchResults: res.results || [],
          showSearchResults: true
        })
      } else {
        showToast('搜索失败')
      }
    } catch (error) {
      console.error('搜索失败:', error)
      showToast('网络错误')
    }
  },

  // 点击搜索按钮
  searchDestination() {
    const keyword = this.data.destinationText
    if (keyword.trim().length > 0) {
      this.performSearch(keyword)
    }
  },

  // 选择搜索结果
  selectSearchResult(e) {
    const index = e.currentTarget.dataset.index
    const result = this.data.searchResults[index]

    this.setData({
      targetPoint: {
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.address
      },
      destinationText: result.name,
      showSearchResults: false,
      searchResults: []
    })

    // 移动地图到目的地
    this.setData({
      longitude: result.longitude,
      latitude: result.latitude,
      scale: 16
    })

    showToast(`已选择: ${result.name}`, 'success')
  },

  // 清除目的地
  clearDestination() {
    this.setData({
      destinationText: '',
      targetPoint: null,
      targetParking: null,
      showSearchResults: false,
      searchResults: [],
      showRoute: false,
      polyline: []
    })
    app.globalData.targetParking = null
  },

  // ========== 地图选点功能 ==========

  // 地图长按选择目的地
  onMapLongPress(e) {
    const { latitude, longitude } = e.detail

    wx.showModal({
      title: '确认选择',
      content: `是否将此位置设为目的地？\n经度: ${longitude.toFixed(6)}\n纬度: ${latitude.toFixed(6)}`,
      success: (res) => {
        if (res.confirm) {
          this.setData({
            targetPoint: {
              name: '自定义位置',
              latitude: latitude,
              longitude: longitude,
              address: `经度:${longitude.toFixed(4)}, 纬度:${latitude.toFixed(4)}`
            },
            destinationText: '自定义位置',
            showSearchResults: false
          })
          showToast('已选择目的地', 'success')
        }
      }
    })
  },

  // 使用微信内置地图选点
  chooseLocationOnMap() {
    wx.chooseLocation({
      success: (res) => {
        if (res.name || res.address) {
          this.setData({
            targetPoint: {
              name: res.name || '选择的位置',
              latitude: res.latitude,
              longitude: res.longitude,
              address: res.address
            },
            destinationText: res.name || '选择的位置',
            longitude: res.longitude,
            latitude: res.latitude
          })
          showToast('已选择目的地', 'success')
        }
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('auth deny')) {
          showToast('请授权使用位置信息')
        }
      }
    })
  },

  // 从停车场列表选择
  chooseFromParking() {
    const parkingLots = app.globalData.parkingLots || []
    
    if (parkingLots.length === 0) {
      showToast('暂无可用停车场')
      return
    }

    wx.showActionSheet({
      itemList: parkingLots.map(lot => `${lot.name} (空余:${lot.available_spots}/${lot.total_spots})`),
      success: (res) => {
        const lot = parkingLots[res.tapIndex]
        this.setData({
          targetParking: lot,
          targetPoint: {
            name: lot.name,
            latitude: lot.latitude,
            longitude: lot.longitude,
            address: '停车场'
          },
          destinationText: lot.name
        })
        showToast(`已选择: ${lot.name}`, 'success')
      }
    })
  },

  // ========== 导航功能 ==========

  // 开始导航 - 调用腾讯地图API规划真实路线，绘制在小程序地图上
  async startNavigation() {
    const target = this.data.targetPoint
    if (!target || !this.data.currentLocation) {
      showToast('请先选择目的地')
      return
    }

    // 需要登录才能使用路线规划功能
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '路线规划功能需要登录后使用，是否前往登录？',
        confirmText: '去登录',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }

    if (TENCENT_MAP_KEY === 'YOUR_TENCENT_MAP_KEY') {
      showToast('请先配置腾讯地图Key')
      return
    }

    showLoading('路线规划中...')

    try {
      const routeData = await this.callTencentRouteAPI(
        this.data.currentLocation.latitude,
        this.data.currentLocation.longitude,
        target.latitude,
        target.longitude
      )

      hideLoading()

      if (routeData.success) {
        this.drawRouteOnMap(routeData)
        showToast('路线规划完成', 'success')
      } else {
        showToast(routeData.error || '路线规划失败')
      }
    } catch (error) {
      hideLoading()
      console.error('路线规划失败:', error)
      showToast('网络错误，请重试')
    }
  },

  // 调用腾讯地图驾车路线规划API
  callTencentRouteAPI(fromLat, fromLng, toLat, toLng) {
    return new Promise((resolve) => {
      wx.request({
        url: 'https://apis.map.qq.com/ws/direction/v1/driving/',
        data: {
          from: `${fromLat},${fromLng}`,
          to: `${toLat},${toLng}`,
          key: TENCENT_MAP_KEY,
          output: 'json'
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.status === 0) {
            const route = res.data.result.routes[0]
            const steps = (route.steps || []).map(step => ({
              instruction: step.instruction,
              distance: step.distance,
              duration: step.duration,
              polyline: step.polyline
            }))
            resolve({ success: true, distance: route.distance, duration: route.duration, steps })
          } else {
            const msg = (res.data && res.data.message) ? res.data.message : '路线规划失败'
            resolve({ success: false, error: msg })
          }
        },
        fail: (err) => {
          console.error('腾讯地图请求失败:', err)
          resolve({ success: false, error: '网络请求失败，请检查网络' })
        }
      })
    })
  },

  // 解码腾讯地图 polyline（差分编码，返回 GCJ-02 坐标数组）
  decodeTencentPolyline(polyline) {
    if (!polyline || !Array.isArray(polyline) || polyline.length < 2) return []
    
    const points = []
    let prevLat = 0, prevLng = 0

    for (let i = 0; i < polyline.length; i += 2) {
      let lat = polyline[i] / 1000000.0
      let lng = polyline[i + 1] / 1000000.0

      if (i > 0) {
        lat = prevLat + lat
        lng = prevLng + lng
      }

      points.push({ latitude: lat, longitude: lng })
      prevLat = lat
      prevLng = lng
    }
    return points
  },

  // 在地图上绘制完整路线
  drawRouteOnMap(routeData) {
    const { steps, distance, duration } = routeData
    const target = this.data.targetPoint

    // 拼接所有步骤的 polyline 为完整路线坐标
    let allPoints = []
    steps.forEach(step => {
      const pts = this.decodeTencentPolyline(step.polyline)
      if (pts.length > 0) allPoints = allPoints.concat(pts)
    })

    // 路线 polyline
    const polyline = [{
      points: allPoints,
      color: '#1890FF',
      width: 7,
      arrowLine: true,
      borderColor: '#0050b3',
      borderWidth: 2
    }]

    // 添加起点/终点标记（保留停车场标记）
    const baseMarkers = this.data.markers.filter(m => m.id !== 9998 && m.id !== 9999)
    const markers = [
      ...baseMarkers,
      {
        id: 9998,
        latitude: this.data.currentLocation.latitude,
        longitude: this.data.currentLocation.longitude,
        width: 28, height: 28,
        callout: { content: '起点', color: '#1890ff', fontSize: 11, borderRadius: 4, bgColor: '#fff', padding: 5, display: 'ALWAYS' }
      },
      {
        id: 9999,
        latitude: target.latitude,
        longitude: target.longitude,
        width: 28, height: 28,
        callout: { content: target.name, color: '#e74c3c', fontSize: 11, borderRadius: 4, bgColor: '#fff', padding: 5, display: 'ALWAYS' }
      }
    ]

    // 自适应缩放展示完整路线
    if (allPoints.length > 0) {
      const mapCtx = wx.createMapContext('navMap', this)
      mapCtx.includePoints({
        points: allPoints,
        padding: [80, 50, 200, 50]
      })
    }

    this.setData({
      markers,
      polyline,
      routeData: { steps, distance, duration },
      distanceText: this.formatDistance(distance),
      durationText: this.formatDuration(duration),
      showRoute: true
    })
  },

  // 格式化距离
  formatDistance(meters) {
    if (!meters || meters <= 0) return ''
    if (meters < 1000) return `${Math.round(meters)}米`
    return `${(meters / 1000).toFixed(2)}公里`
  },

  // 格式化时间
  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return ''
    const minutes = Math.ceil(seconds / 60)
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const remainMin = minutes % 60
    return `${hours}小时${remainMin}分钟`
  },

  // 关闭路线信息卡片
  hideRouteCard() {
    this.setData({ showRoute: false })
  },

  // 重置导航
  resetNavigation() {
    this.setData({
      targetParking: null,
      targetPoint: null,
      routeData: null,
      polyline: [],
      showRoute: false,
      distanceText: '',
      durationText: '',
      destinationText: '',
      showSearchResults: false,
      searchResults: []
    })
    this.loadParkingMarkers()
    app.globalData.targetParking = null
  }
})
