// app.js
const config = require('./config')

App({
  globalData: {
    // 用户信息
    userInfo: null,
    userId: null,
    token: null,
    isLogin: false,

    // CloudBase 环境 ID
    envId: config.cloudbaseEnvId,

    // 服务器配置
    serverUrl: config.serverUrl,

    // 地图配置
    mapConfig: {
      schoolCenter: {
        latitude: 28.132,    // 中南林业科技大学中心纬度
        longitude: 112.994    // 中南林业科技大学中心经度
      },
      schoolBounds: {
        min_lat: 28.1300,
        max_lat: 28.1350,
        min_lon: 112.991,
        max_lon: 112.996
      }
    },
    
    // 停车场数据
    parkingLots: []
  },

  onLaunch() {
    console.log('小程序启动')

    // 初始化 CloudBase
    if (!wx.cloud) {
      console.error('请使用微信开发者工具或微信客户端打开')
      return
    }

    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    })

    // 检查登录状态
    this.checkLoginStatus()
  },

  onShow() {
    console.log('小程序显示')
  },

  // 检查登录状态
  checkLoginStatus() {
    const userInfo = wx.getStorageSync('userInfo')
    const userId = wx.getStorageSync('userId')
    const token = wx.getStorageSync('token')

    if (userInfo && userId && token) {
      this.globalData.userInfo = userInfo
      this.globalData.userId = userId
      this.globalData.token = token
      this.globalData.isLogin = true
    }
  },

  // 保存登录信息
  saveLoginInfo(userInfo, token) {
    this.globalData.userInfo = userInfo
    this.globalData.userId = userInfo.id
    this.globalData.token = token
    this.globalData.isLogin = true

    wx.setStorageSync('userInfo', userInfo)
    wx.setStorageSync('userId', userInfo.id)
    wx.setStorageSync('token', token)
  },

  // 退出登录
  logout() {
    this.globalData.userInfo = null
    this.globalData.userId = null
    this.globalData.token = null
    this.globalData.isLogin = false

    wx.removeStorageSync('userInfo')
    wx.removeStorageSync('userId')
    wx.removeStorageSync('token')

    // 回到首页（不强制跳转登录页）
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 网络请求封装 - 通过 CloudBase 云函数代理 (绕过 ICP 备案限制)
  request(options) {
    const { url, method = 'GET', data = {}, header = {} } = options

    console.log('=== 网络请求(云函数代理) ===')
    console.log('Path:', url)
    console.log('Method:', method)
    console.log('Data:', data)

    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'apiProxy',
        data: {
          path: url,
          method: method,
          data: data,
          headers: {
            'content-type': 'application/json',
            ...header
          }
        },
        success: (res) => {
          const result = res.result
          console.log('云函数响应:', result)
          if (result && result.success) {
            if (result.statusCode === 200) {
              resolve(result.data)
            } else {
              console.error('请求返回错误状态码:', result.statusCode, result.data)
              reject(result)
            }
          } else {
            console.error('云函数返回失败:', result)
            reject(result)
          }
        },
        fail: (err) => {
          console.error('云函数调用失败:', err)
          console.error('错误详情:', JSON.stringify(err))
          wx.showToast({
            title: '网络请求失败',
            icon: 'none'
          })
          reject(err)
        }
      })
    })
  },

  // 获取用户位置
  getUserLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude
          })
        },
        fail: (err) => {
          wx.showModal({
            title: '提示',
            content: '需要获取您的位置信息才能使用导航功能',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting()
              }
            }
          })
          reject(err)
        }
      })
    })
  }
})
