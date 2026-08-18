// pages/welcome/welcome.js
const app = getApp()

Page({
  data: {
    userInfo: {}
  },

  onLoad() {
    // 获取用户信息
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')

    if (!userInfo) {
      // 如果没有登录信息，返回登录页
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }

    // 如果没有自定义昵称,使用微信昵称
    const displayNickname = userInfo.nickname || userInfo.nickName || '用户'

    this.setData({
      userInfo: {
        ...userInfo,
        nickname: displayNickname
      }
    })

    // 3秒后自动跳转到主页
    this.timer = setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      })
    }, 3000)
  },

  onUnload() {
    // 页面卸载时清除定时器
    if (this.timer) {
      clearTimeout(this.timer)
    }
  }
})
