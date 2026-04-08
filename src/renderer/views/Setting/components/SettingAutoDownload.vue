<template lang="pug">
dt#auto_download {{ $t('auto_download_title') }}
dd
  div
    p 快速搜索并下载专辑歌曲
    p.format-tip 分别输入歌手名和专辑名进行搜索
dd
  h3 搜索参数
  div
    div(:class="$style.formRow")
      label 专辑名
      input(
        v-model="albumName"
        type="text"
        placeholder="例如：七里香"
      )
    div(:class="$style.formRow")
      label 歌手名
      input(
        v-model="singerName"
        type="text"
        placeholder="例如：周杰伦"
      )
    div(:class="$style.formRow")
      label 专辑歌曲个数
      input(
        v-model="albumCount"
        type="number"
        placeholder="例如：10"
        min="1"
      )
dd
  div
    base-btn.btn(max :disabled="isLoading || !albumName.trim() || !albumCount" @click="handleConfirm")
      span(v-if="isLoading" :class="$style.loading")
      span(v-else) {{ $t('auto_download_start') }}
    p(v-if="errorMsg" :class="$style.error") {{ errorMsg }}
    p(v-if="statusMsg" :class="$style.status") {{ statusMsg }}
    div(v-if="foundPlaylistName" :class="$style.resultSection")
      p(:class="$style.success") 找到歌单：{{ foundPlaylistName }}（共{{ foundPlaylistSongs.length }}首）
      div(:class="$style.songList")
        div(v-for="(song, index) in foundPlaylistSongs" :key="index" :class="$style.songItem")
          span.index {{ index + 1 }}.
          span.name {{ song.name }}
          span.artist - {{ song.singer }}

Modal(:show="showConfirmModal" :close-btn="true" @close="handleConfirmCancel")
  div(:class="$style.modalContent")
    header
      h3 {{ $t('auto_download_confirm_title') }}
    main
      p.confirm-tip 共{{ confirmList.length }}首歌曲：{{ confirmAlbumName }}
      div(:class="$style.songList")
        div(v-for="(song, index) in confirmList" :key="index" :class="$style.songItem")
          span.index {{ index + 1 }}.
          span.name {{ song.name }}
          span.artist - {{ song.singer }}
    footer
      base-btn(@click="handleConfirmCancel") {{ $t('cancel_button_text') }}
      base-btn(@click="handleConfirmDownload") {{ $t('confirm_button_text') }}
</template>

<script>
import { ref, watch, onMounted } from 'vue'
import { useI18n } from '@root/lang'
import musicSdk from '@renderer/utils/musicSdk'
import { appSetting } from '@renderer/store/setting'
import { createDownloadTasksWithPath } from '@renderer/store/download/action'
import { joinPath } from '@common/utils/nodejs'
import { filterFileName } from '@common/utils/common'
import { toNewMusicInfo, deduplicationList } from '@renderer/utils'
import Modal from '@renderer/components/material/Modal.vue'

const STORAGE_KEY = 'auto_download_singer_name'

export default {
  name: 'SettingAutoDownload',
  components: {
    Modal,
  },
  setup() {
    const t = useI18n()
    const albumName = ref('')
    const singerName = ref('')
    const albumCount = ref(null)
    const errorMsg = ref('')
    const statusMsg = ref('')
    const isLoading = ref(false)
    const showConfirmModal = ref(false)
    const confirmList = ref([])
    const confirmAlbumName = ref('')
    const confirmSavePath = ref('')
    const foundPlaylistName = ref('')
    const foundPlaylistSongs = ref([])

    // 从 localStorage 读取歌手名
    onMounted(() => {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        singerName.value = saved
      }
    })

    // 监听歌手名变化，保存到 localStorage
    watch(singerName, (val) => {
      localStorage.setItem(STORAGE_KEY, val)
    })

    const handleConfirmCancel = () => {
      showConfirmModal.value = false
      confirmList.value = []
      confirmAlbumName.value = ''
      confirmSavePath.value = ''
      isLoading.value = false
      statusMsg.value = ''
    }

    const handleConfirmDownload = async() => {
      showConfirmModal.value = false
      statusMsg.value = t('auto_download_start_download')
      try {
        await createDownloadTasksWithPath(
          confirmList.value,
          appSetting['download.quality'] ?? '320k',
          confirmSavePath.value,
        )
        statusMsg.value = t('auto_download_success')
        albumName.value = ''
        albumCount.value = null
      } catch (err) {
        console.error(err)
        errorMsg.value = t('auto_download_error') + err.message
      } finally {
        confirmList.value = []
        confirmAlbumName.value = ''
        confirmSavePath.value = ''
      }
    }

    const handleConfirm = async() => {
      const name = albumName.value.trim()
      const singer = singerName.value.trim()
      const count = albumCount.value
      if (!name || !count) return

      // 拼接搜索词：歌手名 + 空格 + 专辑 + 空格 + 专辑名
      const input = singer ? `${singer} 专辑 ${name}` : `专辑 ${name}`

      errorMsg.value = ''
      foundPlaylistName.value = ''
      isLoading.value = true
      statusMsg.value = t('auto_download_searching')

      try {
        const searchResult = await musicSdk.tx.songList.search(input, 1, 30)
        if (!searchResult.list.length) {
          errorMsg.value = t('auto_download_not_found')
          isLoading.value = false
          return
        }

        statusMsg.value = t('auto_download_matching')
        let matchedList = null

        for (const playlist of searchResult.list) {
          statusMsg.value = t('auto_download_checking') + playlist.name + ` (${playlist.total}首)`
          const detail = await musicSdk.tx.songList.getListDetail(playlist.id)
          // 使用 toNewMusicInfo 和 deduplicationList 处理歌曲数据，与手动下载保持一致
          console.log('获取到的歌单详情:', detail)
          // 过滤确保每个元素都是对象且有必要的字段
          const validList = detail.list.filter(item => {
            if (!item || typeof item !== 'object') {
              console.warn('过滤掉非对象元素:', item)
              return false
            }
            return true
          })
          console.log('过滤后的歌曲列表长度:', validList.length)
          const processedList = deduplicationList(validList.map(m => {
            try {
              return toNewMusicInfo(m)
            } catch (e) {
              console.warn('toNewMusicInfo 处理失败:', m, e)
              return null
            }
          }).filter(Boolean))
          console.log('处理后的歌曲列表长度:', processedList.length, '歌曲ID示例:', processedList.slice(0, 3).map(s => s.id))
          if (processedList.length === count) {
            matchedList = { list: processedList, info: detail.info, playlistName: playlist.name }
            break
          }
        }

        if (!matchedList) {
          errorMsg.value = t('auto_download_not_found_count').replace('{count}', String(count))
          isLoading.value = false
          return
        }

        foundPlaylistName.value = matchedList.playlistName
        foundPlaylistSongs.value = matchedList.list
        statusMsg.value = ''

        const _singerName = matchedList.info.author ?? ''
        const _albumName = matchedList.info.name ?? ''

        if (count < 5) {
          confirmList.value = matchedList.list
          confirmAlbumName.value = _albumName || _singerName
          confirmSavePath.value = joinPath(
            appSetting['download.savePath'],
            filterFileName(_singerName) || '未知歌手',
            filterFileName(_albumName) || '未知专辑',
          )
          isLoading.value = false
          statusMsg.value = ''
          showConfirmModal.value = true
          return
        }

        statusMsg.value = t('auto_download_start_download')
        const savePath = joinPath(
          appSetting['download.savePath'],
          filterFileName(matchedList.info.author) || '未知歌手',
          filterFileName(matchedList.info.name) || '未知专辑',
        )
        await createDownloadTasksWithPath(
          matchedList.list,
          appSetting['download.quality'] ?? '320k',
          savePath,
        )
        statusMsg.value = t('auto_download_success')
        albumName.value = ''
        albumCount.value = null
      } catch (err) {
        console.error(err)
        errorMsg.value = t('auto_download_error') + err.message
      } finally {
        isLoading.value = false
      }
    }

    return {
      albumName,
      singerName,
      albumCount,
      errorMsg,
      statusMsg,
      isLoading,
      handleConfirm,
      showConfirmModal,
      confirmList,
      confirmAlbumName,
      foundPlaylistName,
      foundPlaylistSongs,
      handleConfirmCancel,
      handleConfirmDownload,
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
.success {
  color: #27ae60;
  margin-top: 10px;
  user-select: text;
}

.resultSection {
  margin-top: 15px;
  padding: 10px;
  background: var(--color-primary-light-100-alpha-100);
  border-radius: 4px;
  user-select: text;
}
.loading {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.btn {
  margin-top: 10px;
}

.format-tip {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin: 5px 0;
}
.format-example {
  font-size: 12px;
  color: var(--color-text);
  font-family: monospace;
  background: var(--color-primary-light-100-alpha-100);
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.formRow {
  display: flex;
  align-items: center;
  margin-bottom: 12px;

  label {
    flex: 0 0 100px;
    text-align: right;
    padding-right: 12px;
    font-size: 12px;
    color: var(--color-text);
  }

  input {
    flex: 1;
    max-width: 300px;
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

.modalContent {
  min-width: 360px;
  max-width: 450px;
  user-select: text;
  header {
    padding: 15px;
    border-bottom: 1px solid var(--color-border);
    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }
  }
  main {
    padding: 15px;
    max-height: 400px;
    overflow-y: auto;
  }
  footer {
    padding: 15px;
    border-top: 1px solid var(--color-border);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
}

.confirm-tip {
  font-size: 14px;
  color: var(--color-text);
  margin-bottom: 15px;
  user-select: text;
}

.songList {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  margin-top: 10px;
  user-select: text;
}

.songItem {
  display: flex;
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);
  user-select: text;
  &:last-child {
    border-bottom: none;
  }
  .index {
    flex: 0 0 30px;
    color: var(--color-text-secondary);
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .artist {
    flex: 0 0 auto;
    margin-left: 8px;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
}
</style>
