// 微信小程序登录云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { code, nickname, avatar } = event
  const wxContext = cloud.getWXContext()

  try {
    // 获取openid
    const openid = wxContext.OPENID

    if (!openid) {
      return {
        success: false,
        error: '获取用户信息失败'
      }
    }

    // 查找用户
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()

    let userData

    if (userRes.data.length > 0) {
      // 用户已存在，更新登录时间
      const user = userRes.data[0]
      await db.collection('users').doc(user._id).update({
        data: {
          lastLogin: new Date(),
          nickname: nickname || user.nickname,
          avatar: avatar || user.avatar,
          updateTime: new Date()
        }
      })
      userData = { ...user, ...{ lastLogin: new Date(), nickname: nickname || user.nickname, avatar: avatar || user.avatar } }
    } else {
      // 创建新用户
      const createRes = await db.collection('users').add({
        data: {
          openid: openid,
          nickname: nickname || '微信用户',
          avatar: avatar || '',
          role: 'student',
          createTime: new Date(),
          lastLogin: new Date()
        }
      })
      userData = {
        _id: createRes._id,
        openid: openid,
        nickname: nickname || '微信用户',
        avatar: avatar || '',
        role: 'student',
        createTime: new Date(),
        lastLogin: new Date()
      }
    }

    return {
      success: true,
      message: '登录成功',
      data: {
        id: userData._id,
        openid: userData.openid,
        nickname: userData.nickname,
        avatar: userData.avatar,
        role: userData.role,
        token: userData.openid
      }
    }
  } catch (error) {
    console.error('登录失败:', error)
    return {
      success: false,
      error: error.message || '登录失败'
    }
  }
}
