<template lang="pug">
Modal(:show="visible" :close-btn="true" @close="handleCancel")
  div(:class="$style.content")
    header(:class="$style.header")
      h2(:class="$style.title") {{ $t('download_album_title') }}
    main(:class="$style.main")
      p(:class="$style.tip") {{ $t('download_album_tip') }}
      p(:class="$style.example") {{ $t('download_album_example') }}
      .form-group
        label {{ $t('download_album_search_label') }}
        input(
          v-model="searchInput"
          type="text"
          :class="$style.input"
          :placeholder="$t('download_album_search_placeholder')"
        )
      .form-group
        label {{ $t('download_album_count_label') }}
        input(
          v-model="albumCount"
          type="number"
          :class="$style.input"
          :placeholder="$t('download_album_count_placeholder')"
          min="1"
        )
      p(v-if="errorMsg" :class="$style.error") {{ errorMsg }}
      p(v-if="statusMsg" :class="$style.status") {{ statusMsg }}
    footer(:class="$style.footer")
      base-btn.btn(v-if="!isLoading" @click="handleCancel") {{ $t('cancel_button_text') }}
      base-btn.btn(:class="$style.confirmBtn" :disabled="isLoading || !searchInput.trim() || !albumCount" @click="handleConfirm")
        span(v-if="isLoading" :class="$style.loading")
        span(v-else) {{ $t('confirm_button_text') }}

Modal(:show="showConfirmModal" :close-btn="true" @close="handleConfirmCancel")
  div(:class="$style.content")
    header(:class="$style.header")
      h2(:class="$style.title") {{ $t('download_album_confirm_title') }}
    main(:class="$style.main")
      p {{ $t('download_album_confirm_tip').replace('{count}', String(confirmList.length)).replace('{albumName}', confirmAlbumName) }}
      div(:class="$style.songList")
        div(v-for="(song, index) in confirmList" :key="index" :class="$style.songItem")
          span(:class="$style.songIndex") {{ index + 1 }}.
          span(:class="$style.songName") {{ song.name }}
          span(:class="$style.songArtist") - {{ song.singer }}
    footer(:class="$style.footer")
      base-btn.btn(@click="handleConfirmCancel") {{ $t('cancel_button_text') }}
      base-btn.btn(:class="$style.confirmBtn" @click="handleConfirmDownload") {{ $t('confirm_button_text') }}
</template>

<script>
import { ref, watch } from 'vue'
import Modal from '@renderer/components/material/Modal.vue'
import { useI18n } from '@renderer/plugins/i18n'
import musicSdk from '@renderer/utils/musicSdk'
import { getListDetail } from '@renderer/store/songList/action'
import { appSetting } from '@renderer/store/setting'
import { createDownloadTasksWithPath } from '@renderer/store/download/action'
import { joinPath } from '@common/utils/nodejs'
import { filterFileName } from '@common/utils/common'

export default {
  name: 'DownloadAlbumModal',
  components: {
    Modal,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const t = useI18n()
    const visible = ref(props.show)
    const searchInput = ref('')
    const albumCount = ref<number | null>(null)
    const errorMsg = ref('')
    const statusMsg = ref('')
    const isLoading = ref(false)

    // 确认弹窗相关
    const showConfirmModal = ref(false)
    const confirmList = ref([])
    const confirmAlbumName = ref('')
    const confirmSavePath = ref('')

    watch(() => props.show, (val) => {
      visible.value = val
      if (val) {
        searchInput.value = ''
        albumCount.value = null
        errorMsg.value = ''
        statusMsg.value = ''
        isLoading.value = false
        showConfirmModal.value = false
        confirmList.value = []
        confirmAlbumName.value = ''
        confirmSavePath.value = ''
      }
    })

    const handleCancel = () => {
      emit('close')
    }

    // 取消确认弹窗
    const handleConfirmCancel = () => {
      showConfirmModal.value = false
      confirmList.value = []
      confirmAlbumName.value = ''
      confirmSavePath.value = ''
      isLoading.value = false
      statusMsg.value = ''
    }

    // 确认下载
    const handleConfirmDownload = async() => {
      showConfirmModal.value = false
      statusMsg.value = t('download_album_creating_tasks')

      try {
        // 深拷贝歌曲列表，确保没有 Vue 响应式代理
        const rawConfirmList = JSON.parse(JSON.stringify(confirmList.value))
        await createDownloadTasksWithPath(
          rawConfirmList,
          appSetting['download.quality'] ?? '320k',
          confirmSavePath.value,
          (status, info) => {
            if (status === 'created') {
              statusMsg.value = t('download_album_tasks_created').replace('{count}', String(info.total))
            } else if (status === 'downloading') {
              if (info.currentSong) {
                statusMsg.value = t('download_album_downloading_song')
                  .replace('{current}', info.currentSong)
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              } else {
                statusMsg.value = t('download_album_downloading')
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              }
            } else if (status === 'complete') {
              statusMsg.value = t('download_album_all_success').replace('{count}', String(info.total))
              setTimeout(() => {
                emit('close')
              }, 1500)
            } else if (status === 'error') {
              const failedNames = info.failedSongs?.join('、') ?? ''
              statusMsg.value = t('download_album_partial_success')
                .replace('{success}', String(info.completed))
                .replace('{failed}', String(info.failed))
                .replace('{names}', failedNames)
            }
          },
        )
      } catch (err) {
        console.error(err)
        errorMsg.value = t('download_album_error') + err.message
      } finally {
        confirmList.value = []
        confirmAlbumName.value = ''
        confirmSavePath.value = ''
      }
    }

    const handleConfirm = async() => {
      const input = searchInput.value.trim()
      const count = albumCount.value
      if (!input || !count) return

      errorMsg.value = ''
      isLoading.value = true
      statusMsg.value = t('download_album_searching')

      try {
        // 1. 搜索歌单（直接用用户输入的搜索字段）
        const searchResult = await musicSdk.wy.songList.search(input, 1, 30)

        if (!searchResult.list.length) {
          errorMsg.value = t('download_album_not_found')
          isLoading.value = false
          return
        }

        statusMsg.value = t('download_album_matching')

        let matchedList = null

        // 2. 遍历所有搜索结果，查找歌曲数量匹配的专辑
        for (const playlist of searchResult.list) {
          statusMsg.value = t('download_album_checking') + playlist.name + ` (${playlist.total}首)`

          // 获取歌单详情
          const detail = await getListDetail(playlist.id, 'wy', 1, true)

          // 3. 检查歌曲数量是否匹配用户输入的个数
          if (detail.list.length === count) {
            matchedList = {
              list: detail.list,
              info: detail.info,
            }
            break
          }
        }

        if (!matchedList) {
          errorMsg.value = t('download_album_not_found_count').replace('{count}', String(count))
          isLoading.value = false
          return
        }

        // 4. 从歌曲列表中提取歌手名和专辑名（而不是从歌单信息）
        const firstSong = matchedList.list[0]
        const _singerName = firstSong?.singer ?? ''
        const _albumName = firstSong?.meta?.albumName ?? ''

        // 5. 如果歌曲数量 < 5，弹窗确认
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

        // 6. 歌曲数量 >= 5，直接下载
        statusMsg.value = t('download_album_creating_tasks')

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
              statusMsg.value = t('download_album_tasks_created').replace('{count}', String(info.total))
            } else if (status === 'downloading') {
              if (info.currentSong) {
                statusMsg.value = t('download_album_downloading_song')
                  .replace('{current}', info.currentSong)
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              } else {
                statusMsg.value = t('download_album_downloading')
                  .replace('{completed}', String(info.completed))
                  .replace('{total}', String(info.total))
              }
            } else if (status === 'complete') {
              statusMsg.value = t('download_album_all_success').replace('{count}', String(info.total))
              setTimeout(() => {
                emit('close')
              }, 1500)
            } else if (status === 'error') {
              const failedNames = info.failedSongs?.join('、') ?? ''
              statusMsg.value = t('download_album_partial_success')
                .replace('{success}', String(info.completed))
                .replace('{failed}', String(info.failed))
                .replace('{names}', failedNames)
            }
          },
        )

        if (!totalTasks) {
          errorMsg.value = t('download_album_no_tasks')
          isLoading.value = false
        }
      } catch (err) {
        console.error(err)
        errorMsg.value = t('download_album_error') + err.message
      } finally {
        isLoading.value = false
      }
    }

    return {
      visible,
      searchInput,
      albumCount,
      errorMsg,
      statusMsg,
      isLoading,
      handleCancel,
      handleConfirm,
      showConfirmModal,
      confirmList,
      confirmAlbumName,
      confirmSavePath,
      handleConfirmCancel,
      handleConfirmDownload,
    }
  },
}
</script>

<style lang="less" module>
.content {
  min-width: 400px;
  max-width: 500px;
}

.header {
  padding: 15px;
  border-bottom: 1px solid var(--color-border);
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.main {
  padding: 15px;
}

.tip {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--color-text);
}

.example {
  margin: 0 0 15px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.form-group {
  margin-bottom: 15px;

  label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    color: var(--color-text);
  }
}

.input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: var(--color-primary);
  }
}

.error {
  margin: 10px 0 0;
  font-size: 12px;
  color: #e74c3c;
}

.status {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--color-primary);
}

.footer {
  padding: 15px;
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirmBtn {
  min-width: 80px;
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
</style>
