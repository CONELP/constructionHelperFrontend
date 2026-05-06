<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { useProjectStore } from '@/app/context/stores/project'
import { useDocumentSetting } from '@/features/project-admin/document-setting/view-model/useDocumentSetting'

const projectStore = useProjectStore()
const { selectedProjectId } = storeToRefs(projectStore)

const {
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
} = useDocumentSetting()

const scriptPromptPlaceholder = `예) 라인은 시트 0의 5행부터 시작하며, 사진은 시트 1의 A10/A15/A20 자리에 카테고리 순서대로 배치한다.
- 양식의 특수 셀 위치, 페이지 분할, 머리글/꼬리말 등 LLM 이 양식변경/내용입력 스크립트를 생성할 때 참고할 자유 텍스트 지침을 작성하세요.
- 비워두면 LLM 은 기본 동작으로 생성합니다.`

const templateFileInput = ref<HTMLInputElement | null>(null)
const templateRefFileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  if (selectedProjectId.value) load(selectedProjectId.value)
})

watch(selectedProjectId, (pid) => {
  if (pid) load(pid)
})

async function onTemplateFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    input.value = ''
    return
  }
  try {
    await uploadTemplate(selectedProjectId.value, file)
  } finally {
    input.value = ''
  }
}

async function onTemplateRefFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    input.value = ''
    return
  }
  try {
    await uploadTemplateRef(selectedProjectId.value, file)
  } finally {
    input.value = ''
  }
}

function onSaveScriptPrompt() {
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    return
  }
  saveScriptPrompt(selectedProjectId.value)
}
</script>

<template>
  <div v-if="isLoading" class="text-sm text-muted-foreground text-center py-8">
    설정 로딩 중...
  </div>

  <div v-else class="flex flex-col gap-6">
    <div class="flex flex-col gap-2 rounded-md border border-border p-3">
      <Label class="text-sm font-semibold">MIR 엑셀 템플릿 (실제 출력용)</Label>
      <p class="text-xs text-muted-foreground">
        · 문서 생성 결과물의 base 가 되는 실제 출력용 xlsx.
      </p>
      <div class="flex items-center gap-3">
        <span class="text-sm text-muted-foreground">
          {{ mirTemplateUrl ? '템플릿 등록됨' : '템플릿 없음' }}
        </span>
        <input
          ref="templateFileInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="onTemplateFileChange"
        />
        <Button
          variant="outline"
          size="sm"
          :disabled="isUploadingTemplate"
          @click="templateFileInput?.click()"
        >
          {{ isUploadingTemplate ? '업로드 중...' : (mirTemplateUrl ? '템플릿 변경' : '템플릿 등록') }}
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-2 rounded-md border border-border p-3">
      <Label class="text-sm font-semibold">MIR 참조용 템플릿 (LLM 가이드용)</Label>
      <div class="text-xs text-muted-foreground space-y-1">
        <p>· placeholder 만 남긴 xlsx. LLM 양식변경·내용입력 directive 생성의 base 로 사용됩니다.</p>
        <p>· 실제 출력용 템플릿과 셀 위치 / 시트 구조가 동일해야 합니다. (같은 directive 가 양쪽에 적용됨)</p>
        <p>· 미등록 상태에서 문서 생성 호출 시 <code>TEMPLATE_REF_NOT_CONFIGURED</code> 로 실패합니다.</p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-sm text-muted-foreground">
          {{ mirTemplateRefUrl ? '참조 템플릿 등록됨' : '참조 템플릿 없음' }}
        </span>
        <input
          ref="templateRefFileInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="onTemplateRefFileChange"
        />
        <Button
          variant="outline"
          size="sm"
          :disabled="isUploadingTemplateRef"
          @click="templateRefFileInput?.click()"
        >
          {{ isUploadingTemplateRef ? '업로드 중...' : (mirTemplateRefUrl ? '참조 템플릿 변경' : '참조 템플릿 등록') }}
        </Button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <Label>MIR 스크립트 프롬프트</Label>
      <div class="text-xs text-muted-foreground space-y-1">
        <p>· MIR 문서 생성 시 양식변경 / 내용입력 LLM 호출에 매번 함께 전달되는 자유 텍스트 지침입니다.</p>
        <p>· 양식의 특수 규칙(라인 시작 위치, 사진 카테고리(<code>DELIVERY_NOTE</code> / <code>MILL_SHEET</code> / <code>TAG</code> / <code>DELIVERY_PHOTO</code>) 배치, 페이지 분할 등)을 작성하세요.</p>
        <p>· 비워두면 기본 동작으로 생성됩니다.</p>
      </div>
      <textarea
        v-model="scriptPrompt"
        :placeholder="scriptPromptPlaceholder"
        :disabled="isSavingScriptPrompt"
        rows="14"
        class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
      />
      <div class="flex justify-end">
        <Button :disabled="isSavingScriptPrompt" @click="onSaveScriptPrompt">
          {{ isSavingScriptPrompt ? '저장 중...' : '스크립트 프롬프트 저장' }}
        </Button>
      </div>
    </div>
  </div>
</template>
