import { ref } from 'vue'
import { docConfigApi } from '@/shared/network-core/apis/docConfig'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

export function useDocumentSetting() {
  const exists = ref(false)
  const isLoading = ref(false)
  const isSavingScriptPrompt = ref(false)
  const isUploadingTemplate = ref(false)
  const isUploadingTemplateRef = ref(false)

  const mirTemplateUrl = ref<string | null>(null)
  const mirTemplateRefUrl = ref<string | null>(null)
  const scriptPrompt = ref('')

  async function load(projectId: string) {
    isLoading.value = true
    try {
      const res = await docConfigApi.getDocConfig(projectId)
      exists.value = true
      mirTemplateUrl.value = res.mirTemplateUrl
      mirTemplateRefUrl.value = res.mirTemplateRefUrl
      scriptPrompt.value = res.mirScriptPrompt ?? ''
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string }
      if (err.response?.status === 404 || err.response?.status === 400) {
        exists.value = false
        mirTemplateUrl.value = null
        mirTemplateRefUrl.value = null
        scriptPrompt.value = ''
      } else {
        console.error('문서 설정 로드 실패:', error)
        alert(err.response?.data?.message || err.message)
      }
    } finally {
      isLoading.value = false
    }
  }

  async function ensureExists(projectId: string) {
    if (exists.value) return
    const res = await docConfigApi.createDocConfig(projectId)
    exists.value = true
    mirTemplateUrl.value = res.mirTemplateUrl
    mirTemplateRefUrl.value = res.mirTemplateRefUrl
    scriptPrompt.value = res.mirScriptPrompt ?? ''
  }

  async function uploadTemplate(projectId: string, file: File) {
    isUploadingTemplate.value = true
    try {
      await ensureExists(projectId)
      const res = await docConfigApi.uploadTemplate(projectId, 'MIR', file)
      mirTemplateUrl.value = res.mirTemplateUrl
      analyticsClient.trackAction('admin_document_setting', 'upload_mir_template', 'success')
      alert('템플릿이 업로드되었습니다.')
    } catch (error: unknown) {
      console.error('템플릿 업로드 실패:', error)
      analyticsClient.trackAction('admin_document_setting', 'upload_mir_template', 'fail')
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      alert(err.response?.data?.message || err.message)
    } finally {
      isUploadingTemplate.value = false
    }
  }

  async function uploadTemplateRef(projectId: string, file: File) {
    isUploadingTemplateRef.value = true
    try {
      await ensureExists(projectId)
      const res = await docConfigApi.uploadTemplateRef(projectId, 'MIR', file)
      mirTemplateRefUrl.value = res.mirTemplateRefUrl
      analyticsClient.trackAction('admin_document_setting', 'upload_mir_template_ref', 'success')
      alert('참조용 템플릿이 업로드되었습니다.')
    } catch (error: unknown) {
      console.error('참조용 템플릿 업로드 실패:', error)
      analyticsClient.trackAction('admin_document_setting', 'upload_mir_template_ref', 'fail')
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      alert(err.response?.data?.message || err.message)
    } finally {
      isUploadingTemplateRef.value = false
    }
  }

  async function saveScriptPrompt(projectId: string) {
    isSavingScriptPrompt.value = true
    try {
      await ensureExists(projectId)
      const trimmed = scriptPrompt.value.trim()
      const res = await docConfigApi.updateScriptPrompt(projectId, {
        docType: 'MIR',
        prompt: trimmed.length > 0 ? trimmed : null,
      })
      scriptPrompt.value = res.mirScriptPrompt ?? ''
      analyticsClient.trackAction('admin_document_setting', 'save_mir_script_prompt', 'success')
      alert('스크립트 프롬프트가 저장되었습니다.')
    } catch (error: unknown) {
      console.error('스크립트 프롬프트 저장 실패:', error)
      analyticsClient.trackAction('admin_document_setting', 'save_mir_script_prompt', 'fail')
      const err = error as { response?: { data?: { message?: string } }; message?: string }
      alert(err.response?.data?.message || err.message)
    } finally {
      isSavingScriptPrompt.value = false
    }
  }

  return {
    exists,
    isLoading,
    isSavingScriptPrompt,
    isUploadingTemplate,
    isUploadingTemplateRef,
    mirTemplateUrl,
    mirTemplateRefUrl,
    scriptPrompt,
    load,
    uploadTemplate,
    uploadTemplateRef,
    saveScriptPrompt,
  }
}
