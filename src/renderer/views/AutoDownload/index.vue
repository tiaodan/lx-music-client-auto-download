<template lang="pug">
div(:class="$style.container")
  h1(:class="$style.title") {{ $t('auto_download_title') }}
  main(:class="$style.main")
    p(:class="$style.tip") {{ $t('auto_download_tip') }}
    p(:class="$style.example") {{ $t('auto_download_example') }}
    .form-group
      label {{ $t('auto_download_album_label') }}
      base-input(
        v-model="albumName"
        :class="$style.formInput"
        :placeholder="$t('auto_download_album_placeholder')"
      )
    .form-group
      label {{ $t('auto_download_singer_label') }}
      base-input(
        v-model="singerName"
        :class="$style.formInput"
        :placeholder="$t('auto_download_singer_placeholder')"
      )
    .form-group
      label {{ $t('auto_download_count_label') }}
      base-input(
        v-model="albumCount"
        :class="$style.formInput"
        type="number"
        :placeholder="$t('auto_download_count_placeholder')"
      )
    footer(:class="$style.footer")
      base-btn(:class="$style.btn" :disabled="isLoading || !albumName.trim() || !albumCount" @click="handleConfirm")
        span(v-if="isLoading" :class="$style.loading")
        span(v-else) {{ $t('auto_download_start') }}
    p(v-if="errorMsg" :class="$style.error") {{ errorMsg }}
    p(v-if="statusMsg" :class="$style.status") {{ statusMsg }}
    // 匹配到的歌单信息
    div(v-if="matchedPlaylistInfo" :class="$style.matchedInfo")
      p(:class="$style.matchedHeader")
        span(:class="$style.platformTag") QQ音乐
        span(:class="$style.matchedName") {{ matchedPlaylistInfo.name }}
      div(:class="$style.songPreview")
        div(v-for="(song, index) in matchedPlaylistInfo.songs.slice(0, 5)" :key="index" :class="$style.songItem")
          span(:class="$style.songIndex") {{ index + 1 }}.
          span(:class="$style.songName") {{ song.name }}
          span(:class="$style.songArtist") - {{ song.singer }}
        p(v-if="matchedPlaylistInfo.songs.length > 5" :class="$style.moreSongs") 等 {{ matchedPlaylistInfo.songs.length }} 首

  // 确认弹窗
  Modal(:show="showConfirmModal" :close-btn="true" @close="handleConfirmCancel")
    div(:class="$style.content")
      header(:class="$style.header")
        h2(:class="$style.title") {{ $t('auto_download_confirm_title') }}
      main(:class="$style.main")
        p {{ $t('auto_download_confirm_tip').replace('{count}', String(confirmList.length)).replace('{albumName}', confirmAlbumName) }}
        div(:class="$style.songList")
          div(v-for="(song, index) in confirmList" :key="index" :class="$style.songItem")
            span(:class="$style.songIndex") {{ index + 1 }}.
            span(:class="$style.songName") {{ song.name }}
            span(:class="$style.songArtist") - {{ song.singer }}
      footer(:class="$style.footer")
        base-btn(@click="handleConfirmCancel") {{ $t('cancel_button_text') }}
        base-btn(:class="$style.confirmBtn" @click="handleConfirmDownload") {{ $t('confirm_button_text') }}
</template>

<script>
import { ref } from 'vue'
import Modal from '@renderer/components/material/Modal.vue'
import BaseInput from '@renderer/components/base/Input.vue'
import { useI18n } from '@renderer/plugins/i18n'
import musicSdk from '@renderer/utils/musicSdk'
import { getListDetail } from '@renderer/store/songList/action'
import { appSetting } from '@renderer/store/setting'
import { createDownloadTasksWithPath } from '@renderer/store/download/action'
import { joinPath } from '@common/utils/nodejs'
import { filterFileName } from '@common/utils/common'

export default {
  name: 'AutoDownload',
  components: {
    Modal,
    BaseInput,
  },
  setup() {
    const t = useI18n()
    const albumName = ref('')
    const singerName = ref('')
    const albumCount = ref(null)
    const errorMsg = ref('')
    const statusMsg = ref('')
    const isLoading = ref(false)

    // 匹配到的歌单信息
    const matchedPlaylistInfo = ref(null)

    // 确认弹窗相关
    const showConfirmModal = ref(false)
    const confirmList = ref([])
    const confirmAlbumName = ref('')
    const confirmSavePath = ref('')

    const handleConfirmCancel = () => {
      showConfirmModal.value = false
      confirmList.value = []
      confirmAlbumName.value = ''
      confirmSavePath.value = ''
      isLoading.value = false
      statusMsg.value = ''
    }

    const clearState = () => {
      errorMsg.value = ''
      statusMsg.value = ''
      matchedPlaylistInfo.value = null
    }

    const handleConfirmDownload = async() => {
      showConfirmModal.value = false
      statusMsg.value = t('auto_download_creating_tasks')

      try {
        // 深拷贝歌曲列表，确保没有 Vue 响应式代理
        const rawConfirmList = JSON.parse(JSON.stringify(confirmList.value))
        await createDownloadTasksWithPath(
          rawConfirmList,
          appSetting['download.quality'] ?? '320k',
          confirmSavePath.value,
          (status, info) => {
            if (status === 'created') {
              statusMsg.value = t('auto_download_tasks_created').replace('{count}', String(info.total))
            } else if (status === 'downloading') {
              if (info.currentSong) {
                statusMsg.value = t('auto_download_downloading_song')
                  .replace('{current}', info.currentSong)
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              } else {
                statusMsg.value = t('auto_download_downloading')
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              }
            } else if (status === 'complete') {
              statusMsg.value = t('auto_download_all_success').replace('{count}', String(info.total))
              albumName.value = ''
              singerName.value = ''
              albumCount.value = null
              isLoading.value = false
            } else if (status === 'error') {
              const failedNames = info.failedSongs?.join('、') ?? ''
              statusMsg.value = t('auto_download_partial_success')
                .replace('{success}', String(info.completed))
                .replace('{failed}', String(info.failed))
                .replace('{names}', failedNames)
              albumName.value = ''
              singerName.value = ''
              albumCount.value = null
              isLoading.value = false
            }
          },
        )
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

      clearState()
      isLoading.value = true
      statusMsg.value = t('auto_download_searching')

      try {
        // 1. 搜索歌单（QQ音乐）
        const searchResult = await musicSdk.tx.songList.search(input, 1, 30)

        if (!searchResult.list.length) {
          errorMsg.value = t('auto_download_not_found')
          isLoading.value = false
          return
        }

        statusMsg.value = t('auto_download_matching')

        let matchedList = null

        // 2. 遍历所有搜索结果，查找歌曲数量匹配的专辑
        for (const playlist of searchResult.list) {
          statusMsg.value = t('auto_download_checking') + playlist.name + ` (${playlist.total}首)`

          const detail = await getListDetail(playlist.id, 'tx', 1, true)

          if (detail.list.length === count) {
            matchedList = {
              list: detail.list,
              info: detail.info,
            }
            break
          }
        }

        if (!matchedList) {
          errorMsg.value = t('auto_download_not_found_count').replace('{count}', String(count))
          isLoading.value = false
          return
        }

        // 3. 使用用户输入的歌手名和专辑名创建下载目录
        // name 和 singer 在函数开头已定义：用户输入的专辑名和歌手名
        const _albumName = name
        const _singerName = singer

        // 显示匹配到的歌单信息
        matchedPlaylistInfo.value = {
          name: _albumName || _singerName,
          songs: matchedList.list,
        }

        // 4. 如果歌曲数量 < 5，弹窗确认
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

        // 5. 歌曲数量 >= 5，直接下载
        statusMsg.value = t('auto_download_creating_tasks')

        const savePath = joinPath(
          appSetting['download.savePath'],
          filterFileName(_singerName) || '未知歌手',
          filterFileName(_albumName) || '未知专辑',
        )

        // 深拷贝歌曲列表，确保没有 Vue 响应式代理
        const rawSongList = JSON.parse(JSON.stringify(matchedList.list))
        const totalTasks = await createDownloadTasksWithPath(
          rawSongList,
          appSetting['download.quality'] ?? '320k',
          savePath,
          (status, info) => {
            if (status === 'created') {
              statusMsg.value = t('auto_download_tasks_created').replace('{count}', String(info.total))
            } else if (status === 'downloading') {
              if (info.currentSong) {
                statusMsg.value = t('auto_download_downloading_song')
                  .replace('{current}', info.currentSong)
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              } else {
                statusMsg.value = t('auto_download_downloading')
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              }
            } else if (status === 'complete') {
              statusMsg.value = t('auto_download_all_success').replace('{count}', String(info.total))
              albumName.value = ''
              singerName.value = ''
              albumCount.value = null
              isLoading.value = false
            } else if (status === 'error') {
              const failedNames = info.failedSongs?.join('、') ?? ''
              statusMsg.value = t('auto_download_partial_success')
                .replace('{success}', String(info.completed))
                .replace('{failed}', String(info.failed))
                .replace('{names}', failedNames)
              albumName.value = ''
              singerName.value = ''
              albumCount.value = null
              isLoading.value = false
            }
          },
        )

        if (!totalTasks) {
          errorMsg.value = t('auto_download_no_tasks')
          isLoading.value = false
        }
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
      matchedPlaylistInfo,
      handleConfirm,
      showConfirmModal,
      confirmList,
      confirmAlbumName,
      handleConfirmCancel,
      handleConfirmDownload,
    }
  },
}
</script>

<style lang="less" module>
.container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.title {
  font-size: 24px;
  font-weight: 500;
  margin: 0 0 20px;
  color: var(--color-text);
}

.main {
  background: var(--color-content-background);
  padding: 20px;
  border-radius: 8px;
}

.tip {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--color-text);
}

.example {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.form-group {
  margin-bottom: 20px;

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--color-text);
    padding-left: 8px;
  }
}

.formInput {
  display: block;
  width: 100%;
  box-sizing: border-box;

  &::placeholder {
    color: var(--color-200) !important;
  }
}

.error {
  margin: 15px 0 0;
  font-size: 13px;
  color: #e74c3c;
}

.status {
  margin: 15px 0 0;
  font-size: 13px;
  color: var(--color-primary);
}

.footer {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.btn {
  min-width: 150px;
  padding: 10px 30px;
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
  to {
    transform: rotate(360deg);
  }
}

.content {
  min-width: 400px;
  max-width: 500px;
}

.header {
  padding: 15px;
  border-bottom: 1px solid var(--color-border);
}

.songList {
  max-height: 300px;
  overflow-y: auto;
  margin-top: 15px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.songItem {
  display: flex;
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.songIndex {
  flex: 0 0 30px;
  color: var(--color-text-secondary);
}

.songName {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.songArtist {
  flex: 0 0 auto;
  margin-left: 8px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.confirmBtn {
  min-width: 80px;
}

.matchedInfo {
  margin-top: 20px;
  padding: 15px;
  background: var(--color-content-background);
  border-radius: 8px;
}

.matchedHeader {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
}

.platformTag {
  padding: 2px 8px;
  font-size: 12px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 4px;
}

.matchedName {
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text);
}

.songPreview {
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 8px 0;
}

.moreSongs {
  margin: 8px 12px 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
