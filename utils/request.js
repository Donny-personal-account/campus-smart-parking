// 网络请求封装 - 通过 CloudBase 云函数代理 (绕过 ICP 备案限制)
const app = getApp()

/**
 * 通过云函数代理转发请求到后端
 * 云函数运行在腾讯云内部网络，不受 ICP 备案阻断
 */
function request(options) {
  const { url, method = 'GET', data = {}, header = {}, needAuth = true } = options

  // 构建请求头
  const requestHeader = {
    'content-type': 'application/json',
    ...header
  }

  // 如果需要认证，添加token
  if (needAuth) {
    const token = wx.getStorageSync('token')
    if (token) {
      requestHeader['Authorization'] = `Bearer ${token}`
    }
  }

  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'apiProxy',
      data: {
        path: url,
        method: method,
        data: data,
        headers: requestHeader
      },
      success: (res) => {
        const result = res.result
        if (result && result.success) {
          if (result.statusCode === 200) {
            resolve(result.data)
          } else if (result.statusCode === 401) {
            // 未授权，清除缓存并跳转到登录页
            wx.showToast({
              title: '登录已过期，请重新登录',
              icon: 'none'
            })
            wx.removeStorageSync('token')
            wx.removeStorageSync('userInfo')
            wx.removeStorageSync('userId')
            app.globalData.userInfo = null
            app.globalData.userId = null
            app.globalData.token = null
            app.globalData.isLogin = false
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/login/login' })
            }, 1500)
            reject(result)
          } else {
            reject(result)
          }
        } else {
          reject(result || res)
        }
      },
      fail: (err) => {
        console.error('云函数调用失败:', err)
        wx.showToast({
          title: '网络请求失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

/**
 * GET请求
 */
function get(url, data = {}, needAuth = true) {
  return request({
    url,
    method: 'GET',
    data,
    needAuth
  })
}

/**
 * POST请求
 */
function post(url, data = {}, needAuth = true) {
  return request({
    url,
    method: 'POST',
    data,
    needAuth
  })
}

/**
 * PUT请求
 */
function put(url, data = {}, needAuth = true) {
  return request({
    url,
    method: 'PUT',
    data,
    needAuth
  })
}

/**
 * DELETE请求
 */
function del(url, data = {}, needAuth = true) {
  return request({
    url,
    method: 'DELETE',
    data,
    needAuth
  })
}

/**
 * 显示Toast
 */
function showToast(title, icon = 'none', duration = 2000) {
  wx.showToast({
    title,
    icon,
    duration
  })
}

/**
 * 显示Loading
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏Loading
 */
function hideLoading() {
  wx.hideLoading()
}

module.exports = {
  request,
  get,
  post,
  put,
  delete: del,
  showToast,
  showLoading,
  hideLoading
}

