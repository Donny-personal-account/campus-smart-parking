// pages/profile-edit/profile-edit.js
const app = getApp()

Page({
  data: {
    userInfo: {
      nickname: '',
      avatar: '',
      realName: '',
      studentId: '',
      phone: '',
      email: ''
    },
    tempAvatar: ''
  },

  onLoad() {
    this.loadUserInfo()
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    
    if (userInfo) {
      this.setData({
        userInfo: {
          nickname: userInfo.nickname || '',
          avatar: userInfo.avatar || '',
          realName: '',
          studentId: '',
          phone: '',
          email: ''
        },
        tempAvatar: userInfo.avatar || ''
      })
    }
  },

  // 表单输入
  handleInput(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    
    this.setData({
      [`userInfo.${field}`]: value
    })
  },

  // 选择头像 - 使用微信头像组件
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    this.setData({
      tempAvatar: avatarUrl
    })
  },

  // 上传头像（通过云函数代理，绕过ICP限制）
  async uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      // 读取文件为 base64
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath: filePath,
        encoding: 'base64',
        success: async (fileRes) => {
          try {
            const result = await wx.cloud.callFunction({
              name: 'apiProxy',
              data: {
                path: '/user/avatar',
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + app.globalData.token
                },
                fileBase64: fileRes.data,
                fileName: filePath.split('/').pop() || 'avatar.jpg'
              }
            })
            
            const cloudRes = result.result
            if (cloudRes && cloudRes.success && cloudRes.statusCode === 200) {
              const data = cloudRes.data
              if (data.success) {
                resolve(data.data.avatarUrl)
              } else {
                reject(new Error(data.error || '上传失败'))
              }
            } else {
              reject(new Error('上传失败'))
            }
          } catch (e) {
            reject(e)
          }
        },
        fail: (err) => {
          console.error('读取文件失败:', err)
          reject(new Error('读取文件失败'))
        }
      })
    })
  },

  // 保存信息
  async handleSave() {
    const { userInfo } = this.data

    // 表单验证
    if (!userInfo.nickname.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '保存中...'
    })

    try {
      let avatarUrl = userInfo.avatar

      // 如果选择了新头像,先上传
      if (this.data.tempAvatar && this.data.tempAvatar !== userInfo.avatar) {
        try {
          avatarUrl = await this.uploadAvatar(this.data.tempAvatar)
        } catch (error) {
          console.error('上传头像失败:', error)
          wx.showToast({
            title: '头像上传失败',
            icon: 'none'
          })
          wx.hideLoading()
          return
        }
      }

      // 提交用户信息
      const res = await app.request({
        url: '/user/update',
        method: 'POST',
        data: {
          nickname: userInfo.nickname,
          avatar: avatarUrl,
          realName: userInfo.realName,
          studentId: userInfo.studentId,
          phone: userInfo.phone,
          email: userInfo.email
        }
      })

      if (res.success) {
        // 更新本地用户信息
        const updatedUserInfo = {
          ...app.globalData.userInfo,
          ...res.data
        }
        app.globalData.userInfo = updatedUserInfo
        wx.setStorageSync('userInfo', updatedUserInfo)

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        // 返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.error || '保存失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('保存失败:', error)
      wx.showToast({
        title: '网络错误,请重试',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  }
})
