<template lang="pug">
dt#rank_auto_import {{ $t('rank_auto_import') }}
dd
  div
    p 快速获取榜单数据并发送到后台服务器
    p.format-tip 配置后台服务器地址后，可以获取酷狗TOP500、QQ音乐热歌榜等榜单数据
dd
  h3 服务器配置
  div
    div(:class="$style.formRow")
      label 后台服务器地址
      input(
        v-model="serverAddress"
        type="text"
        placeholder="例如：http://localhost:8080"
      )
    div(:class="$style.formRow")
      label 下载文件夹路径
      input(
        v-model="downloadPath"
        type="text"
        placeholder="例如：C:\\Music\\kugou_top500"
      )
dd
  h3 预制榜单配置
  div
    div(:class="$style.rankList")
      div(v-for="rank in presetRanks" :key="rank.id" :class="$style.rankItem")
        span(:class="$style.rankName") {{ rank.displayName }}
        span(:class="$style.rankSource") {{ rank.sourceLabel }}
        input(
          v-model="rank.folderPath"
          type="text"
          placeholder="文件夹路径"
          :class="$style.folderInput"
        )
        base-btn.btn-sm(:disabled="isLoading || !serverAddress.trim()" @click="handleGetRank(rank)")
          span(v-if="currentLoading === rank.id" :class="$style.loading")
          span(v-else) 获取榜单
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
</template>

<script>
import { ref, onMounted } from 'vue'
import { httpFetch } from '@renderer/utils/request'
import musicSdk from '@renderer/utils/musicSdk'

const STORAGE_KEY_SERVER = 'rank_auto_import_server'
const STORAGE_KEY_DOWNLOAD_PATH = 'rank_auto_import_download_path'
const STORAGE_KEY_WEBSITES = 'rank_auto_import_websites'
const STORAGE_KEY_WEBSITE_URL = 'rank_auto_import_website_url'

export default {
  name: 'SettingRankAutoImport',
  setup() {
    const serverAddress = ref('')
    const downloadPath = ref('')
    const websiteUrl = ref('')
    const errorMsg = ref('')
    const statusMsg = ref('')
    const isLoading = ref(false)
    const isLoadingWebsites = ref(false)
    const currentLoading = ref('')
    const websites = ref([])

    // 预制榜单配置
    const presetRanks = ref([
      {
        id: 'kg_top500',
        source: 'kg',
        bangId: '8888',
        displayName: '酷狗TOP500',
        sourceLabel: '酷狗',
        folderPath: '',
      },
      {
        id: 'tx_hot',
        source: 'tx',
        bangId: '26',
        displayName: 'QQ音乐热歌榜',
        sourceLabel: 'QQ音乐',
        folderPath: '',
      },
    ])

    // 从 localStorage 读取配置
    onMounted(() => {
      const savedServer = localStorage.getItem(STORAGE_KEY_SERVER)
      const savedDownloadPath = localStorage.getItem(STORAGE_KEY_DOWNLOAD_PATH)
      const savedWebsites = localStorage.getItem(STORAGE_KEY_WEBSITES)
      const savedWebsiteUrl = localStorage.getItem(STORAGE_KEY_WEBSITE_URL)
      if (savedServer) serverAddress.value = savedServer
      if (savedDownloadPath) downloadPath.value = savedDownloadPath
      if (savedWebsiteUrl) websiteUrl.value = savedWebsiteUrl
      if (savedWebsites) {
        try {
          websites.value = JSON.parse(savedWebsites)
        } catch (e) {
          websites.value = []
        }
      }
      // 恢复预制榜单的 folderPath
      presetRanks.value.forEach(rank => {
        const savedFolderPath = localStorage.getItem(`rank_${rank.id}_folder`)
        if (savedFolderPath) rank.folderPath = savedFolderPath
      })
    })

    // 保存服务器地址到 localStorage
    const saveConfig = () => {
      localStorage.setItem(STORAGE_KEY_SERVER, serverAddress.value)
      localStorage.setItem(STORAGE_KEY_DOWNLOAD_PATH, downloadPath.value)
      presetRanks.value.forEach(rank => {
        localStorage.setItem(`rank_${rank.id}_folder`, rank.folderPath)
      })
    }

    // 获取后台网站数据
    const handleGetWebsites = async() => {
      const url = websiteUrl.value.trim()
      if (!url) return

      errorMsg.value = ''
      isLoadingWebsites.value = true
      statusMsg.value = '正在获取后台网站数据...'

      try {
        const resp = await httpFetch(`${url}/website`).promise
        if (resp.statusCode !== 200) {
          errorMsg.value = `获取失败：HTTP ${resp.statusCode}`
          return
        }
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

    // 获取榜单数据并发送到后台
    const handleGetRank = async(rank) => {
      const server = serverAddress.value.trim()
      if (!server) return

      errorMsg.value = ''
      isLoading.value = true
      currentLoading.value = rank.id
      statusMsg.value = `正在获取${rank.displayName}榜单数据...`

      try {
        // 使用 musicSdk 获取榜单数据
        const result = await musicSdk[rank.source].leaderboard.getList(rank.bangId, 1)
        if (!result?.list?.length) {
          errorMsg.value = '获取榜单失败：无数据'
          return
        }

        statusMsg.value = `已获取 ${result.list.length} 首歌曲，正在发送到后台...`

        // 发送到后台
        const websiteId = websites.value.length ? websites.value[0].id : null
        const resp = await httpFetch(`${server}/rank`, {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            website_id: websiteId,
            name: rank.displayName,
            folder_path: rank.folderPath || downloadPath.value,
            songs: result.list.map(song => ({
              name: song.name,
              singer: song.singer,
              album: song.albumName,
              source: song.source,
            })),
          }),
        }).promise

        if (resp.statusCode !== 200) {
          errorMsg.value = `发送失败：HTTP ${resp.statusCode}`
          return
        }

        statusMsg.value = `${rank.displayName}榜单数据已成功发送到后台！共 ${result.list.length} 首歌曲`
        saveConfig()
      } catch (err) {
        console.error(err)
        errorMsg.value = `操作失败：${err.message}`
      } finally {
        isLoading.value = false
        currentLoading.value = ''
      }
    }

    return {
      serverAddress,
      downloadPath,
      websiteUrl,
      errorMsg,
      statusMsg,
      isLoading,
      isLoadingWebsites,
      currentLoading,
      websites,
      presetRanks,
      handleGetWebsites,
      handleGetRank,
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

.format-tip {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 5px 0;
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

.rankList {
  margin-top: 10px;
}

.rankItem {
  display: flex;
  align-items: center;
  padding: 10px;
  margin-bottom: 8px;
  background: var(--color-primary-light-100-alpha-100);
  border-radius: 4px;
}

.rankName {
  flex: 0 0 120px;
  font-size: 13px;
  color: var(--color-text);
  font-weight: 500;
}

.rankSource {
  flex: 0 0 60px;
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-right: 10px;
}

.folderInput {
  flex: 1;
  max-width: 300px;
  padding: 6px 10px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-sizing: border-box;
  outline: none;
  background-color: var(--color-primary-background);
  color: var(--color-button-font);
  margin-right: 10px;
  &:focus {
    border-color: var(--color-primary);
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
</style>
