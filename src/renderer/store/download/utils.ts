import { appSetting } from '@renderer/store/setting'
import { defaultList, loveList, userLists } from '@renderer/store/list/listManage'
import { filterFileName } from '@common/utils/common'
import { clipFileNameLength } from '@common/utils/tools'
import { joinPath } from '@common/utils/nodejs'

export const buildSavePath = (musicInfo: LX.Download.ListItem) => {
  // 如果已经有完整的文件路径，直接返回其目录
  if (musicInfo.metadata.filePath) {
    const pathParts = musicInfo.metadata.filePath.split(/[/\\]/)
    pathParts.pop() // 移除文件名
    return pathParts.join('/')
  }

  let savePath = appSetting['download.savePath']
  if (appSetting['download.isSavePathGroupByListName']) {
    let dirName: string | undefined
    const listId = musicInfo.metadata.listId
    switch (listId) {
      case defaultList.id:
        dirName = window.i18n.t(defaultList.name)
        break
      case loveList.id:
        dirName = window.i18n.t(loveList.name)
        break
      default:
        dirName = userLists.find(list => list.id === listId)?.name
        break
    }
    if (dirName) dirName = filterFileName(dirName)
    savePath = joinPath(savePath, clipFileNameLength(dirName ?? window.i18n.t(defaultList.name)))
  }
  return savePath
}
