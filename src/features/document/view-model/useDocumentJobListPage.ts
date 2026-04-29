import { onMounted, ref } from 'vue'
import {
  documentApi,
  type DocumentJobResponse,
} from '@/shared/network-core/apis/document'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

interface ApiError {
  response?: { data?: { message?: string } }
  message?: string
}

const getErrorMessage = (error: unknown): string => {
  const err = error as ApiError
  return err.response?.data?.message || err.message || '알 수 없는 오류가 발생했습니다.'
}

export interface DocumentJobListPageOptions {
  loadList: () => Promise<DocumentJobResponse[]>
  analyticsScope: string
}

export function useDocumentJobListPage(options: DocumentJobListPageOptions) {
  const isLoading = ref(false)
  const list = ref<DocumentJobResponse[]>([])
  const isDownloading = ref<Record<number, boolean>>({})

  const showDeleteDialog = ref(false)
  const deleteTargetId = ref<number | null>(null)
  const deleteTargetName = ref('')
  const isDeleting = ref(false)

  async function loadDocumentList() {
    isLoading.value = true
    try {
      list.value = await options.loadList()
    } catch (error: unknown) {
      console.error('문서 목록 로드 실패:', error)
      alert(getErrorMessage(error))
    } finally {
      isLoading.value = false
    }
  }

  function openDeleteDialog(job: DocumentJobResponse) {
    deleteTargetId.value = job.id
    deleteTargetName.value = job.docNo ?? ''
    showDeleteDialog.value = true
  }

  async function confirmDelete() {
    if (deleteTargetId.value == null) return
    isDeleting.value = true
    try {
      await documentApi.deleteDocument(deleteTargetId.value)
      showDeleteDialog.value = false
      analyticsClient.trackAction(options.analyticsScope, 'delete_document', 'success')
      await loadDocumentList()
    } catch (error: unknown) {
      console.error('문서 삭제 실패:', error)
      analyticsClient.trackAction(options.analyticsScope, 'delete_document', 'fail')
      alert(getErrorMessage(error))
    } finally {
      isDeleting.value = false
    }
  }

  async function downloadDocument(job: DocumentJobResponse) {
    isDownloading.value[job.id] = true
    try {
      const { blob, format } = await documentApi.downloadDocument(job.id)
      const blobUrl = URL.createObjectURL(blob)
      const fileName = `${job.docNo ?? `document-${job.id}`}.${format}`
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(blobUrl)
      analyticsClient.trackAction(options.analyticsScope, 'download_document', 'success')
    } catch (error: unknown) {
      console.error('문서 다운로드 실패:', error)
      analyticsClient.trackAction(options.analyticsScope, 'download_document', 'fail')
      alert(getErrorMessage(error))
    } finally {
      isDownloading.value[job.id] = false
    }
  }

  function formatDate(dateStr: string): string {
    return dateStr.split('T')[0] ?? ''
  }

  onMounted(() => {
    loadDocumentList()
  })

  return {
    isLoading,
    list,
    isDownloading,
    showDeleteDialog,
    deleteTargetName,
    isDeleting,
    loadDocumentList,
    openDeleteDialog,
    confirmDelete,
    downloadDocument,
    formatDate,
  }
}
