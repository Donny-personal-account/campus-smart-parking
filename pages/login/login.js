// pages/login/login.js
const app = getApp()
const { showToast, showLoading, hideLoading } = require('../../utils/request')

Page({
  data: {
    loading: false
  },

  onLoad() {
    // 如果已登录，返回上一页
    if (app.globalData.isLogin) {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }
  },

  // 游客跳过登录，返回上一页或首页
  skipLogin() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      // 如果没有上一页，回到首页
      wx.switchTab({
        url: '/pages/index/index'
      })
    }
  },

  // 微信登录处理
  async handleWechatLogin(e) {
    const { userInfo } = e.detail

    // 检查用户是否授权
    if (!userInfo) {
      showToast('需要授权才能使用')
      return
    }

    this.setData({ loading: true })
    showLoading('登录中...')

    let loadingShown = true

    try {
      // 1. 获取微信登录code
      const loginRes = await wx.login()
      if (!loginRes.code) {
        throw new Error('获取登录code失败')
      }

      // 2. 调用 Spring Boot 后端登录接口,传递微信昵称和头像
      const res = await app.request({
        url: '/auth/wechat/login',
        method: 'POST',
        data: {
          code: loginRes.code,
          nickname: userInfo.nickName,
          avatar: userInfo.avatarUrl
        }
      })

      if (res.success) {
        // 保存登录信息
        app.saveLoginInfo(res.data, res.data.token)

        showToast('登录成功', 'success')

        // 返回来源页
        setTimeout(() => {
          const pages = getCurrentPages()
          if (pages.length > 1) {
            wx.navigateBack()
          } else {
            wx.switchTab({ url: '/pages/index/index' })
          }
        }, 500)
      } else {
        showToast(res.error || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      showToast('登录失败,请重试')
    } finally {
      // 无论成功或失败,都要隐藏 loading
      if (loadingShown) {
        hideLoading()
        loadingShown = false
      }
      this.setData({ loading: false })
    }
  }
})


