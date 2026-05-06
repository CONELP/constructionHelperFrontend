<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import PageContainer from '@/shared/helper-ui/PageContainer.vue'
import AreaCard from '@/shared/helper-ui/AreaCard.vue'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { useProjectStore } from '@/app/context/stores/project'
import { useDocumentNumber } from '@/features/project-admin/document-number/view-model/useDocumentNumber'
import type {
  DocConfigDocType,
  ExcelCellRefDocType,
  ScriptPromptDocType,
  TemplateDocType,
  TemplateRefDocType,
} from '@/shared/network-core/apis/docConfig'

const projectStore = useProjectStore()
const { selectedProjectId } = storeToRefs(projectStore)

const {
  isLoading,
  isSaving,
  isSavingCellRef,
  isGeneratingCellRef,
  isSavingScriptPrompt,
  isUploadingTemplate,
  isUploadingTemplateRef,
  prompts,
  cellRefs,
  scriptPrompts,
  templateUrls,
  templateRefUrls,
  load,
  save,
  saveCellRef,
  generateCellRef,
  saveScriptPrompt,
  uploadTemplate,
  uploadTemplateRef,
} = useDocumentNumber()

const tabs = [
  { value: 'MIR', label: 'MIR (자재검수요청서)' },
  { value: 'CAT', label: 'CAT' },
  { value: 'CCST', label: 'CCST' },
  { value: 'DR', label: 'DR (작업일보)' },
]

const docTypeLabels: Record<DocConfigDocType, string> = {
  MIR: 'MIR',
  CAT: 'CAT',
  CCST: 'CCST',
}

const placeholder = `문서번호는 다음 규칙을 따른다.
- 형식: MIR-{yyyyMMdd}-{division}-{seq2}
- division 은 한글 2글자 자재대분류 (철근/레미콘/거푸집 등)
- seq2 는 해당 날짜+division 조합으로 01 부터 순증가, 두 자리 zero-pad
- 예: "MIR-20260423-철근-01"`

const cellRefPlaceholder = `{
  "fixed": { ... },
  "lines": { ... },
  "lineConcat": { ... },
  "photos": {
    "0": {
      "types": ["DELIVERY_NOTE", "MILL_SHEET"],
      "rotatable": true,
      "cells": ["0!B3", "0!B15"],
      "descriptionOffset": { "row": 3, "col": 0 },
      "overflow": "INSERT_ROWS"
    }
  }
}`

const scriptPromptPlaceholder = `예) 28일 강도 셀 좌표는 시트 2번의 J열에 누적되며, 사진은 한 페이지당 4장 배치한다.
- 양식의 특수한 셀 위치, 페이지 분할, 머리글/꼬리말, 정렬 규칙 등 LLM 이 양식변경/내용입력 스크립트를 생성할 때 참고할 자유 텍스트 지침을 작성하세요.
- 비워두면 LLM 은 기본 동작으로 생성합니다.`

const templateFileInputs = ref<Record<TemplateDocType, HTMLInputElement | null>>({
  MIR: null,
  CAT: null,
})

function setTemplateFileInputRef(docType: TemplateDocType) {
  return (el: unknown) => {
    templateFileInputs.value[docType] = el as HTMLInputElement | null
  }
}

const templateRefFileInputs = ref<Record<TemplateRefDocType, HTMLInputElement | null>>({
  MIR: null,
  CAT: null,
  CCST: null,
})

function setTemplateRefFileInputRef(docType: TemplateRefDocType) {
  return (el: unknown) => {
    templateRefFileInputs.value[docType] = el as HTMLInputElement | null
  }
}

onMounted(() => {
  if (selectedProjectId.value) load(selectedProjectId.value)
})

watch(selectedProjectId, (pid) => {
  if (pid) load(pid)
})

function onSave(docType: DocConfigDocType) {
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    return
  }
  save(selectedProjectId.value, docType)
}

function onGenerateCellRef(docType: ExcelCellRefDocType) {
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    return
  }
  generateCellRef(selectedProjectId.value, docType)
}

function onSaveCellRef(docType: ExcelCellRefDocType) {
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    return
  }
  saveCellRef(selectedProjectId.value, docType)
}

function onSaveScriptPrompt(docType: ScriptPromptDocType) {
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    return
  }
  saveScriptPrompt(selectedProjectId.value, docType)
}

async function onTemplateFileChange(docType: TemplateDocType, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    input.value = ''
    return
  }
  try {
    await uploadTemplate(selectedProjectId.value, docType, file)
  } finally {
    input.value = ''
  }
}

async function onTemplateRefFileChange(docType: TemplateRefDocType, e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!selectedProjectId.value) {
    alert('프로젝트를 먼저 선택해주세요.')
    input.value = ''
    return
  }
  try {
    await uploadTemplateRef(selectedProjectId.value, docType, file)
  } finally {
    input.value = ''
  }
}
</script>

<template>
  <PageContainer title="문서 설정">
    <AreaCard
      height="flex-1"
      min-height="600px"
      :has-tabs="true"
      :tabs="tabs"
      default-tab="MIR"
    >
      <template v-for="docType in (['MIR', 'CAT', 'CCST'] as const)" #[`tab-${docType}`] :key="docType">
        <div v-if="isLoading" class="text-sm text-muted-foreground text-center py-8">
          설정 로딩 중...
        </div>
        <div v-else class="flex flex-col gap-6">
          <div v-if="docType !== 'CCST'" class="flex flex-col gap-2 rounded-md border border-border p-3">
            <Label class="text-sm font-semibold">{{ docTypeLabels[docType] }} 엑셀 템플릿 (실제 출력용)</Label>
            <p class="text-xs text-muted-foreground">
              · 문서 생성 결과물의 base 가 되는 실제 출력용 xlsx.
            </p>
            <div class="flex items-center gap-3">
              <span class="text-sm text-muted-foreground">
                {{ templateUrls[docType as TemplateDocType] ? '템플릿 등록됨' : '템플릿 없음' }}
              </span>
              <input
                :ref="setTemplateFileInputRef(docType as TemplateDocType)"
                type="file"
                accept=".xlsx,.xls"
                class="hidden"
                @change="(e) => onTemplateFileChange(docType as TemplateDocType, e)"
              />
              <Button
                variant="outline"
                size="sm"
                :disabled="isUploadingTemplate[docType as TemplateDocType]"
                @click="templateFileInputs[docType as TemplateDocType]?.click()"
              >
                {{ isUploadingTemplate[docType as TemplateDocType] ? '업로드 중...' : (templateUrls[docType as TemplateDocType] ? '템플릿 변경' : '템플릿 등록') }}
              </Button>
            </div>
          </div>

          <div v-else class="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            <p>· CCST 는 자체 출력용 템플릿을 사용하지 않습니다. CAT 결과 xlsx 위에 덧칠되는 흐름입니다.</p>
            <p>· 문서번호도 CAT 잡의 docNo 를 재사용하므로 별도 규칙이 필요하지 않습니다.</p>
          </div>

          <div class="flex flex-col gap-2 rounded-md border border-border p-3">
            <Label class="text-sm font-semibold">{{ docTypeLabels[docType] }} 참조용 템플릿 (LLM 가이드용)</Label>
            <div class="text-xs text-muted-foreground space-y-1">
              <p>· placeholder 만 남긴 xlsx. LLM 양식변경·내용입력 directive 생성의 base 로 사용됩니다.</p>
              <p v-if="docType !== 'CCST'">· 실제 출력용 템플릿과 셀 위치 / 시트 구조가 동일해야 합니다. (같은 directive 가 양쪽에 적용됨)</p>
              <p v-else>· CCST 는 출력용 템플릿이 따로 없으므로, 참조용 템플릿은 CAT 결과 xlsx 와 구조가 일치해야 합니다.</p>
              <p>· 미등록 상태에서 문서 생성 호출 시 <code>TEMPLATE_REF_NOT_CONFIGURED</code> 로 실패합니다.</p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-muted-foreground">
                {{ templateRefUrls[docType] ? '참조 템플릿 등록됨' : '참조 템플릿 없음' }}
              </span>
              <input
                :ref="setTemplateRefFileInputRef(docType)"
                type="file"
                accept=".xlsx,.xls"
                class="hidden"
                @change="(e) => onTemplateRefFileChange(docType, e)"
              />
              <Button
                variant="outline"
                size="sm"
                :disabled="isUploadingTemplateRef[docType]"
                @click="templateRefFileInputs[docType]?.click()"
              >
                {{ isUploadingTemplateRef[docType] ? '업로드 중...' : (templateRefUrls[docType] ? '참조 템플릿 변경' : '참조 템플릿 등록') }}
              </Button>
            </div>
          </div>

          <div v-if="docType !== 'CCST'" class="flex flex-col gap-2">
            <Label>{{ docTypeLabels[docType] }} 문서번호 생성 규칙</Label>
            <div class="text-xs text-muted-foreground space-y-1">
              <p>· LLM 이 이 텍스트를 그대로 읽고 문서번호를 생성합니다.</p>
              <p>· 포맷 예시, 치환 변수(<code>{yyyyMMdd}</code>, <code>{division}</code> 등), 금지 조건을 구체적으로 기재하세요.</p>
            </div>
            <textarea
              v-model="prompts[docType]"
              :placeholder="placeholder"
              :disabled="isSaving[docType]"
              rows="10"
              class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            />
            <div class="flex justify-end">
              <Button :disabled="isSaving[docType]" @click="onSave(docType)">
                {{ isSaving[docType] ? '저장 중...' : '문서번호 규칙 저장' }}
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <Label>{{ docTypeLabels[docType] }} 스크립트 프롬프트</Label>
            <div class="text-xs text-muted-foreground space-y-1">
              <p>· {{ docTypeLabels[docType] }} 문서 생성 시 양식변경 / 내용입력 LLM 호출에 매번 함께 전달되는 자유 텍스트 지침입니다.</p>
              <p>· 양식의 특수 규칙(셀 누적 위치, 페이지 분할, 머리글/꼬리말 등)을 작성하세요.</p>
              <p>· 비워두면 기본 동작으로 생성됩니다.</p>
            </div>
            <textarea
              v-model="scriptPrompts[docType]"
              :placeholder="scriptPromptPlaceholder"
              :disabled="isSavingScriptPrompt[docType]"
              rows="14"
              class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            />
            <div class="flex justify-end">
              <Button
                :disabled="isSavingScriptPrompt[docType]"
                @click="onSaveScriptPrompt(docType)"
              >
                {{ isSavingScriptPrompt[docType] ? '저장 중...' : '스크립트 프롬프트 저장' }}
              </Button>
            </div>
          </div>
        </div>
      </template>

      <template #tab-DR>
        <div v-if="isLoading" class="text-sm text-muted-foreground text-center py-8">
          설정 로딩 중...
        </div>
        <div v-else class="flex flex-col gap-6 py-2">
          <div>
            <Label>DR (작업일보) 문서번호</Label>
            <p class="text-sm text-muted-foreground mt-1">
              DR 문서번호는 <code>yyyyMMdd</code> 고정 포맷으로 서버가 자동 생성합니다. 편집할 수 없습니다.
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <Label>DR 엑셀 셀 좌표 (JSON)</Label>
            <div class="text-xs text-muted-foreground space-y-1">
              <p>· 작업일보 템플릿의 셀 매핑 JSON.</p>
              <p>· <strong>자동 생성</strong>은 LLM이 템플릿을 분석해 재생성 후 즉시 DB에 저장합니다.</p>
              <p>· 수동 편집 후에는 <strong>셀 좌표 저장</strong>으로 반영. 스키마 위반 시 서버가 400을 반환합니다.</p>
            </div>
            <textarea
              v-model="cellRefs.DR"
              :placeholder="cellRefPlaceholder"
              :disabled="isSavingCellRef.DR || isGeneratingCellRef.DR"
              rows="18"
              class="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            />
            <div class="flex justify-end gap-2">
              <Button
                variant="outline"
                :disabled="isGeneratingCellRef.DR || isSavingCellRef.DR"
                @click="onGenerateCellRef('DR')"
              >
                {{ isGeneratingCellRef.DR ? '생성 중...' : '자동 생성' }}
              </Button>
              <Button
                :disabled="isSavingCellRef.DR || isGeneratingCellRef.DR"
                @click="onSaveCellRef('DR')"
              >
                {{ isSavingCellRef.DR ? '저장 중...' : '셀 좌표 저장' }}
              </Button>
            </div>
          </div>
        </div>
      </template>
    </AreaCard>
  </PageContainer>
</template>
