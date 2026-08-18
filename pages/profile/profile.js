// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    isLogin: false,
    userInfo: {
      nickname: '',
      avatar: '',
      realName: '',
      studentId: '',
      phone: '',
      email: ''
    },
    menuList: [
      {
        id: 'edit',
        icon: 'edit',
        title: '编辑资料',
        arrow: true
      },
      {
        id: 'privacy',
        icon: 'privacy',
        title: '隐私政策',
        arrow: true
      },
      {
        id: 'about',
        icon: 'info',
        title: '关于',
        arrow: true
      }
    ]
  },

  onLoad() {
    this.checkAndLoad()
  },

  onShow() {
    this.checkAndLoad()
  },

  // 检查登录并加载信息（游客不跳转登录页）
  checkAndLoad() {
    const token = wx.getStorageSync('token')
    const isLogin = app.globalData.isLogin && !!token
    this.setData({ isLogin })

    if (isLogin) {
      this.loadUserInfo()
    }
  },

  // 去登录
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      const token = wx.getStorageSync('token')

      if (!userInfo || !token) {
        // 未登录不跳转，保持游客模式
        this.setData({ isLogin: false })
        return
      }

      // 从后端获取最新用户信息
      const res = await app.request({
        url: '/user/profile',
        method: 'GET'
      })

      if (res.success) {
        this.setData({
          isLogin: true,
          userInfo: {
            nickname: res.data.nickname || userInfo.nickname,
            avatar: res.data.avatar || userInfo.avatar,
            realName: res.data.realName || '',
            studentId: res.data.studentId || '',
            phone: res.data.phone || '',
            email: res.data.email || ''
          }
        })
      } else {
        // 如果后端没有数据,使用本地存储的信息
        this.setData({
          isLogin: true,
          userInfo: {
            nickname: userInfo.nickname,
            avatar: userInfo.avatar,
            realName: '',
            studentId: '',
            phone: '',
            email: ''
          }
        })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
      // 使用本地缓存数据
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
      if (userInfo) {
        this.setData({
          isLogin: true,
          userInfo: {
            nickname: userInfo.nickname,
            avatar: userInfo.avatar,
            realName: '',
            studentId: '',
            phone: '',
            email: ''
          }
        })
      }
    }
  },

  // 菜单点击
  handleMenuClick(e) {
    const { id } = e.currentTarget.dataset

    if (id === 'edit') {
      // 编辑资料需要登录
      if (!app.globalData.isLogin) {
        wx.showModal({
          title: '提示',
          content: '编辑资料需要登录，是否前往登录？',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({ url: '/pages/login/login' })
            }
          }
        })
        return
      }
      wx.navigateTo({
        url: '/pages/profile-edit/profile-edit'
      })
    } else if (id === 'privacy') {
      wx.navigateTo({
        url: '/pages/privacy/privacy'
      })
    } else if (id === 'about') {
      wx.showModal({
        title: '关于',
        content: '智慧校园停车系统 v1.2.0\n中南林业科技大学',
        showCancel: false
      })
    }
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗?',
      success: (res) => {
        if (res.confirm) {
          app.logout()
        }
      }
    })
  },

  // 预览头像
  previewAvatar() {
    if (this.data.userInfo.avatar) {
      wx.previewImage({
        urls: [this.data.userInfo.avatar]
      })
    }
  }
})
