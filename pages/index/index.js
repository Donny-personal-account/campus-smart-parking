// pages/index/index.js
const app = getApp()
const { get, post, showLoading, hideLoading, showToast } = require('../../utils/request')

Page({
  data: {
    longitude: 112.994,  // 中南林业科技大学中心经度
    latitude: 28.132,    // 中南林业科技大学中心纬度
    scale: 16,           // 缩放级别，16可以显示整个校园区域
    showLocation: true,
    markers: [],
    showModal: false,
    selectedParking: null,
    polyline: [],  // 路径线条

    // 搜索相关
    searchKeyword: '',
    searchFocused: false,
    showSuggestions: false,
    searchResults: [],
    selectedIndex: -1,
    nearestParkingLots: [],
    showNearest: false,
    userLocation: null
  },

  onLoad() {
    // 直接加载地图数据，不强制登录（游客可浏览）
    this.loadMapData()
  },

  onShow() {
    // 每次显示时刷新数据
    this.refreshParkingStatus()
    // 显示最近停车场推荐
    this.loadNearestParking()
  },

  // 加载地图数据
  async loadMapData() {
    showLoading('加载地图数据...')

    try {
      const res = await get('/navigation/markers')
      
      if (res.success) {
        const mapData = res
        
        // 使用后端返回的初始视图配置（中南林业科技大学区域）
        if (mapData.initial_view) {
          this.setData({
            longitude: mapData.initial_view.lon,
            latitude: mapData.initial_view.lat,
            scale: mapData.initial_view.scale
          })
        } else if (mapData.center) {
          // 兼容旧版本，使用中心坐标
          this.setData({
            longitude: mapData.center.lon,
            latitude: mapData.center.lat
          })
        }
        
        this.setMarkers(mapData.markers || [])
        
        // 缓存停车场数据
        app.globalData.parkingLots = mapData.markers || []
      } else {
        showToast(res.error || '加载地图数据失败')
      }
    } catch (error) {
      showToast('网络错误')
    } finally {
      hideLoading()
    }
  },

  // 刷新停车场状态
  async refreshParkingStatus() {
    try {
      const res = await get('/navigation/markers')
      
      if (res.success) {
        // 更新标记数据
        this.setMarkers(res.markers)
        
        // 更新缓存
        app.globalData.parkingLots = res.markers
      }
    } catch (error) {
      console.error('刷新停车场状态失败:', error)
    }
  },

  // 设置地图标记
  setMarkers(parkingLots) {
    const markers = parkingLots.map((lot, index) => ({
      id: index,
      longitude: lot.longitude,
      latitude: lot.latitude,
      title: lot.name,
      iconPath: '/images/marker.png',
      width: 32,
      height: 32,
      callout: {
        content: `${lot.name}\n空闲: ${lot.available_spots}/${lot.total_spots}`,
        color: '#333',
        fontSize: 12,
        borderRadius: 8,
        bgColor: 'rgba(255,255,255,0.9)',
        padding: 8,
        textAlign: 'center'
      },
      customCallout: {
        ...lot
      }
    }))

    this.setData({ markers })
  },

  // 标记点击事件
  onMarkerTap(e) {
    const { markerId } = e.detail
    const parkingLot = app.globalData.parkingLots[markerId]
    
    this.setData({
      showModal: true,
      selectedParking: parkingLot
    })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({
      showModal: false,
      selectedParking: null,
      polyline: []  // 清除路径
    })
  },

  // 跳转到车位查询
  goToParking() {
    wx.switchTab({
      url: '/pages/parking/parking'
    })
  },

  // 跳转到导航
  goToNavigation() {
    wx.switchTab({
      url: '/pages/navigation/navigation'
    })
  },

  // 从主页导航到停车场
  navigateToParking() {
    if (!this.data.selectedParking) return

    // 需要登录才能使用导航功能
    if (!app.globalData.isLogin) {
      this.showLoginTip('使用导航功能需要登录')
      return
    }

    // 保存目标停车场
    app.globalData.targetParking = this.data.selectedParking

    // 关闭弹窗
    this.closeModal()

    // 跳转到导航页
    wx.switchTab({
      url: '/pages/navigation/navigation'
    })
  },

  // 显示登录引导提示
  showLoginTip(reason) {
    wx.showModal({
      title: '提示',
      content: `${reason}，是否前往登录？`,
      confirmText: '去登录',
      cancelText: '稍后再说',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/login/login'
          })
        }
      }
    })
  },

  // 地图区域变化
  onRegionChange(e) {
    if (e.type === 'end') {
      console.log('地图区域变化', e.detail)
    }
  },

  // ========== 搜索相关方法 ==========

  // 获取用户位置
  getUserLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.setData({
            userLocation: {
              latitude: res.latitude,
              longitude: res.longitude
            }
          })
          resolve(res)
        },
        fail: (err) => {
          console.log('获取位置失败', err)
          reject(err)
        }
      })
    })
  },

  // 加载最近停车场推荐
  async loadNearestParking() {
    try {
      const location = await this.getUserLocation()
      const res = await get(`/search/nearest?lat=${location.latitude}&lon=${location.longitude}&limit=5`)

      if (res.success && res.results.length > 0) {
        this.setData({
          nearestParkingLots: res.results,
          showNearest: true
        })

        // 3秒后自动隐藏
        setTimeout(() => {
          this.setData({ showNearest: false })
        }, 5000)
      }
    } catch (error) {
      console.log('加载最近停车场失败', error)
    }
  },

  // 搜索输入事件
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword,
      showSuggestions: false
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
    showLoading('搜索中...')

    try {
      // 获取用户位置（用于距离计算）
      let lat = null, lon = null
      if (this.data.userLocation) {
        lat = this.data.userLocation.latitude
        lon = this.data.userLocation.longitude
      }

      // 调用搜索和推荐接口
      const res = await post('/search/combine', {
        keyword: keyword,
        lat: lat,
        lon: lon
      })

      hideLoading()

      if (res.success) {
        this.setData({
          searchResults: res.search_results,
          showSuggestions: true,
          nearestParkingLots: res.nearest_parking_lots
        })
      } else {
        showToast('搜索失败')
      }
    } catch (error) {
      hideLoading()
      showToast('网络错误')
      console.error('搜索失败', error)
    }
  },

  // 确认搜索
  onSearch() {
    if (this.data.searchKeyword.trim().length > 0) {
      this.performSearch(this.data.searchKeyword)
    }
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchKeyword: '',
      searchResults: [],
      showSuggestions: false
    })
  },

  // 选择搜索建议
  selectSuggestion(e) {
    const index = e.currentTarget.dataset.index
    const parking = this.data.searchResults[index]

    this.setData({
      searchKeyword: parking.name,
      showSuggestions: false,
      selectedParking: parking,
      showModal: true
    })

    // 移动地图到停车场位置
    if (this.mapContext) {
      this.mapContext.moveToLocation({
        latitude: parking.latitude,
        longitude: parking.longitude
      })
    }
  },

  // 隐藏最近推荐
  hideNearest() {
    this.setData({ showNearest: false })
  },

  // 从搜索结果跳转到停车场
  goToParking(e) {
    const parking = e.currentTarget.dataset.lot
    this.setData({
      selectedParking: parking,
      showModal: true
    })

    // 如果有坐标信息，移动地图
    if (parking && this.mapContext) {
      this.mapContext.moveToLocation({
        latitude: parking.latitude,
        longitude: parking.longitude
      })
    }
  }
})
