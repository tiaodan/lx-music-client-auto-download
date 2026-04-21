<template lang="pug">
dt#rank_auto_import {{ $t('rank_auto_import') }}
dd
  div
    p 快速获取榜单数据并发送到后台服务器
dd
  h3 后台网站数据
  div
    div(:class="$style.formRow")
      label 请求地址
      input(
        v-model="websiteUrl"
        type="text"
        placeholder="例如：http://192.168.1.100:8080"
      )
    base-btn.btn-sm(:class="$style.getWebsiteBtn" :disabled="isLoadingWebsites || !websiteUrl.trim()" @click="handleGetWebsites")
      span(v-if="isLoadingWebsites" :class="$style.loading")
      span(v-else) 获取后台网站数据
    p(v-if="errorMsg" :class="$style.error") {{ errorMsg }}
    p(v-if="statusMsg" :class="$style.status") {{ statusMsg }}
    div(v-if="websites.length" :class="$style.websiteList")
      p(:class="$style.websiteHeader") 后台网站列表：
      div(v-for="website in websites" :key="website.id" :class="$style.websiteItem")
        span(:class="$style.websiteName") {{ website.name }}
        span(:class="$style.websiteType") ({{ website.type }})
dd
  h3 榜单数据
  div
    div(:class="$style.formRow")
      label 下载目录
      input(
        v-model="folderPath"
        type="text"
        placeholder="例如：C:\\Music\\kugou"
      )
    base-btn.btn-sm(:class="$style.getRankBtn" :disabled="isLoadingRank || !websiteUrl.trim()" @click="handleGetKugouTop500")
      span(v-if="isLoadingRank" :class="$style.loading")
      span(v-else) 酷狗TOP500入库
    base-btn.btn-sm(:class="$style.getRankBtn" :disabled="isLoadingRank || !websiteUrl.trim()" @click="handleGetKugouTop100")
      span(v-if="isLoadingRank" :class="$style.loading")
      span(v-else) 酷狗TOP100入库
    p(v-if="rankErrorMsg" :class="$style.error") {{ rankErrorMsg }}
    p(v-if="rankStatusMsg" :class="$style.status") {{ rankStatusMsg }}
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { httpFetch } from '@renderer/utils/request'
import musicSdk from '@renderer/utils/musicSdk'

const STORAGE_KEY_WEBSITES = 'rank_auto_import_websites'
const STORAGE_KEY_WEBSITE_URL = 'rank_auto_import_website_url'
const STORAGE_KEY_FOLDER_PATH = 'rank_auto_import_folder_path'

export default {
  name: 'SettingRankAutoImport',
  setup() {
    const websiteUrl = ref('')
    const folderPath = ref('')
    const errorMsg = ref('')
    const statusMsg = ref('')
    const isLoadingWebsites = ref(false)
    const websites = ref([])
    const isLoadingRank = ref(false)
    const rankErrorMsg = ref('')
    const rankStatusMsg = ref('')

    // 从 localStorage 读取配置
    onMounted(() => {
      const savedWebsiteUrl = localStorage.getItem(STORAGE_KEY_WEBSITE_URL)
      const savedWebsites = localStorage.getItem(STORAGE_KEY_WEBSITES)
      const savedFolderPath = localStorage.getItem(STORAGE_KEY_FOLDER_PATH)
      if (savedWebsiteUrl) websiteUrl.value = savedWebsiteUrl
      if (savedFolderPath) folderPath.value = savedFolderPath
      if (savedWebsites) {
        try {
          websites.value = JSON.parse(savedWebsites)
        } catch (e) {
          websites.value = []
        }
      }
    })

    // 监听 websiteUrl 变化，自动保存到 localStorage
    watch(websiteUrl, (val) => {
      localStorage.setItem(STORAGE_KEY_WEBSITE_URL, val)
    })

    // 监听 folderPath 变化，自动保存到 localStorage
    watch(folderPath, (val) => {
      localStorage.setItem(STORAGE_KEY_FOLDER_PATH, val)
    })

    // 获取后台网站数据
    const handleGetWebsites = async() => {
      const url = websiteUrl.value.trim()
      if (!url) return

      errorMsg.value = ''
      isLoadingWebsites.value = true
      statusMsg.value = '正在获取后台网站数据...'

      try {
        const resp = await httpFetch(`${url}/website`).promise
        // 处理响应格式：{code, success, message, data: [{id, name, type}]}
        const body = resp.body
        if (!body.success || body.code !== 200) {
          errorMsg.value = `获取失败：${body.message || '未知错误'}`
          return
        }
        websites.value = body.data || []
        localStorage.setItem(STORAGE_KEY_WEBSITES, JSON.stringify(websites.value))
        localStorage.setItem(STORAGE_KEY_WEBSITE_URL, url)
        statusMsg.value = `获取成功！共 ${websites.value.length} 个网站`
      } catch (err) {
        console.error(err)
        errorMsg.value = `获取失败：${err.message}`
      } finally {
        isLoadingWebsites.value = false
      }
    }

    // 获取酷狗TOP500数据并发送到后台
    const handleGetKugouTop500 = async() => {
      const url = websiteUrl.value.trim()
      if (!url) return

      rankErrorMsg.value = ''
      rankStatusMsg.value = ''
      isLoadingRank.value = true
      rankStatusMsg.value = '正在获取酷狗TOP500数据（第1/5页）...'

      try {
        // 循环获取5页数据（每页100个，共500个）
        const allSongs = []
        for (let page = 1; page <= 5; page++) {
          rankStatusMsg.value = `正在获取酷狗TOP500数据（第${page}/5页）...`
          const result = await musicSdk.kg.leaderboard.getList('8888', page)
          console.log(`酷狗TOP500第${page}页数据:`, result)
          if (result?.list?.length) {
            allSongs.push(...result.list)
          }
        }

        if (!allSongs.length) {
          rankErrorMsg.value = '获取榜单失败：无数据'
          return
        }

        console.log('酷狗TOP500全部数据:', allSongs)
        rankStatusMsg.value = `已获取 ${allSongs.length} 首歌曲，正在发送到后台...`

        // 发送到后台（酷狗=2）
        const sendData = {
          websiteId: 2,
          rankName: 'top500',
          folderPath: folderPath.value,
          list: allSongs.map(song => ({
            singer: song.singer,
            name: song.name,
            albumName: song.albumName,
            albumId: song.albumId || null,
            songmid: song.songmid || null,
            hash: song.hash || null,
            interval: song.interval || null,
            img: song.img || null,
            lrc: song.lrc || null,
          })),
        }
        console.log('TOP500发送到后台的数据:', sendData)
        const resp = await httpFetch(`${url}/rank/import`, {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sendData),
        }).promise

        const body = resp.body
        if (resp.statusCode !== 200 || !body.success || body.code !== 200) {
          rankErrorMsg.value = `发送失败：${body.message || `HTTP ${resp.statusCode}`}`
          return
        }

        rankStatusMsg.value = `酷狗TOP500数据已成功发送！共 ${allSongs.length} 首歌曲`
      } catch (err) {
        console.error(err)
        rankErrorMsg.value = `操作失败：${err.message}`
      } finally {
        isLoadingRank.value = false
      }
    }

    // 获取酷狗TOP100数据并发送到后台
    const handleGetKugouTop100 = async() => {
      const url = websiteUrl.value.trim()
      if (!url) return

      rankErrorMsg.value = ''
      rankStatusMsg.value = ''
      isLoadingRank.value = true
      rankStatusMsg.value = '正在获取酷狗TOP100数据...'

      try {
        // 只获取第1页（100条）
        const result = await musicSdk.kg.leaderboard.getList('8888', 1)
        console.log('酷狗TOP100数据:', result)
        if (!result?.list?.length) {
          rankErrorMsg.value = '获取榜单失败：无数据'
          return
        }

        rankStatusMsg.value = `已获取 ${result.list.length} 首歌曲，正在发送到后台...`

        // 发送到后台（酷狗=2）
        const sendData = {
          websiteId: 2,
          rankName: 'top100',
          folderPath: folderPath.value,
          list: result.list.map(song => ({
            singer: song.singer,
            name: song.name,
            albumName: song.albumName,
            albumId: song.albumId || null,
            songmid: song.songmid || null,
            hash: song.hash || null,
            interval: song.interval || null,
            img: song.img || null,
            lrc: song.lrc || null,
          })),
        }
        console.log('TOP100发送到后台的数据:', sendData)
        const resp = await httpFetch(`${url}/rank/import`, {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sendData),
        }).promise

        const body = resp.body
        if (resp.statusCode !== 200 || !body.success || body.code !== 200) {
          rankErrorMsg.value = `发送失败：${body.message || `HTTP ${resp.statusCode}`}`
          return
        }

        rankStatusMsg.value = `酷狗TOP100数据已成功发送！共 ${result.list.length} 首歌曲`
      } catch (err) {
        console.error(err)
        rankErrorMsg.value = `操作失败：${err.message}`
      } finally {
        isLoadingRank.value = false
      }
    }

    return {
      websiteUrl,
      folderPath,
      errorMsg,
      statusMsg,
      isLoadingWebsites,
      websites,
      isLoadingRank,
      rankErrorMsg,
      rankStatusMsg,
      handleGetWebsites,
      handleGetKugouTop500,
      handleGetKugouTop100,
    }
  },
}
</script>

<style lang="less" module>
.error {
  color: #e74c3c;
  margin-top: 10px;
  user-select: text;
}

.status {
  color: var(--color-primary);
  margin-top: 10px;
  user-select: text;
}

.formRow {
  display: flex;
  align-items: center;
  margin-bottom: 12px;

  label {
    flex: 0 0 120px;
    text-align: right;
    padding-right: 12px;
    font-size: 12px;
    color: var(--color-text);
  }

  input {
    flex: 1;
    max-width: 400px;
    padding: 8px 12px;
    font-size: 14px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    box-sizing: border-box;
    outline: none;
    background-color: var(--color-primary-background);
    color: var(--color-button-font);
    &:focus {
      border-color: var(--color-primary);
    }
  }
}

.loading {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.websiteList {
  margin-top: 15px;
  padding: 10px;
  background: var(--color-primary-light-100-alpha-100);
  border-radius: 4px;
}

.websiteHeader {
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 8px;
}

.websiteItem {
  display: flex;
  align-items: center;
  font-size: 12px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--color-border);
  &:last-child {
    border-bottom: none;
  }
}

.websiteName {
  color: var(--color-text);
  font-weight: 500;
}

.websiteType {
  margin-left: 6px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.getWebsiteBtn {
  margin-top: 15px;
}

.getRankBtn {
  margin-top: 10px;
}
</style>
