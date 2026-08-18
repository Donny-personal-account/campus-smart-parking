// pages/parking/parking.js
const app = getApp()
const { showLoading, hideLoading, showToast } = require('../../utils/request')
const { getAccurateLocation, requestLocationAuth, calculateDistance } = require('../../utils/location')

Page({
  data: {
    longitude: 112.994,   // 中南林业科技大学中心经度
    latitude: 28.132,     // 中南林业科技大学中心纬度
    scale: 14,            // 缩放级别，14可以显示整个校园区域
    showLocation: true,
    markers: [],
    parkingLots: [],
    userLocation: null,
    refreshing: false
  },

  onLoad() {
    // 直接加载停车场数据，不强制登录（游客可浏览）
    this.loadParkingData()
  },

  onShow() {
    this.getUserLocation()
    this.refreshParkingStatus()
  },

  // 获取用户位置
  async getUserLocation() {
    try {
      await requestLocationAuth()

      const location = await getAccurateLocation(3, 600)
      this.setData({
        userLocation: location,
        longitude: location.longitude,
        latitude: location.latitude
      })
    } catch (error) {
      console.error('定位失败:', error)
      // 定位失败不影响功能，使用默认位置
    }
  },

  // 加载停车场数据
  async loadParkingData() {
    wx.showLoading({
      title: '加载停车场数据...'
    })

    try {
      const res = await app.request({
        url: '/map/parking-status',
        method: 'GET'
      })

      console.log('API 响应数据:', res)
      console.log('停车场数量:', res.parking_lots ? res.parking_lots.length : 0)

      if (res.success) {
        const markers = res.parking_lots || []

        console.log('停车场列表:', markers)
        console.log('标记数量:', this.createMarkers(markers).length)

        this.setData({
          parkingLots: markers,
          markers: this.createMarkers(markers)
        })

        console.log('设置后的数据 - parkingLots:', this.data.parkingLots.length)
        console.log('设置后的数据 - markers:', this.data.markers.length)

        // 缓存数据
        app.globalData.parkingLots = markers
      } else {
        wx.showToast({
          title: res.error || '加载数据失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载停车场数据失败:', error)
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 刷新数据
  async refreshParkingStatus() {
    if (this.data.refreshing) return

    this.setData({ refreshing: true })

    try {
      const res = await app.request({
        url: '/map/parking-status',
        method: 'GET'
      })

      if (res.success) {
        const markers = res.parking_lots || []

        this.setData({
          parkingLots: markers,
          markers: this.createMarkers(markers)
        })

        app.globalData.parkingLots = markers

        wx.showToast({
          title: '刷新成功',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: res.error || '刷新失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('刷新失败:', error)
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    } finally {
      this.setData({ refreshing: false })
    }
  },

  // 手动刷新
  refreshData() {
    this.refreshParkingStatus()
  },

  // 创建地图标记
  createMarkers(parkingLots) {
    return parkingLots.map((lot, index) => ({
      id: index,
      longitude: lot.longitude,
      latitude: lot.latitude,
      title: lot.name,
      iconPath: '/images/parking-marker.png',
      width: 32,
      height: 32,
      callout: {
        content: `${lot.name}\n总: ${lot.total_spots}\n空: ${lot.available_spots}\n占: ${lot.occupied_spots}`,
        color: '#333',
        fontSize: 11,
        borderRadius: 8,
        bgColor: 'rgba(255,255,255,0.95)',
        padding: 8,
        textAlign: 'center'
      },
      customCallout: { ...lot }
    }))
  },

  // 标记点击事件
  onMarkerTap(e) {
    const { markerId } = e.detail
    this.selectParking({ currentTarget: { dataset: { index: markerId } } })
  },

  // 选择停车场
  selectParking(e) {
    const index = e.currentTarget.dataset.index
    const parkingLot = this.data.parkingLots[index]

    // 地图定位到选中的停车场
    this.setData({
      latitude: parkingLot.latitude,
      longitude: parkingLot.longitude,
      scale: 17  // 放大地图以便更清楚看到选中的停车场
    })

    // 显示停车场详情
    wx.showModal({
      title: parkingLot.name,
      content: `总车位: ${parkingLot.total_spots}\n空余车位: ${parkingLot.available_spots}\n占用车位: ${parkingLot.occupied_spots}`,
      confirmText: '导航',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm) {
          // 需要登录才能使用导航功能
          if (!app.globalData.isLogin) {
            wx.showModal({
              title: '提示',
              content: '使用导航功能需要登录，是否前往登录？',
              confirmText: '去登录',
              cancelText: '稍后再说',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.navigateTo({ url: '/pages/login/login' })
                }
              }
            })
            return
          }
          // 跳转到导航页
          app.globalData.targetParking = parkingLot
          wx.switchTab({
            url: '/pages/navigation/navigation'
          })
        }
      }
    })
  }
})
