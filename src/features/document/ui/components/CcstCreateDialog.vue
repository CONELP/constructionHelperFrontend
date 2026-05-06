<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { X } from 'lucide-vue-next'
import { ccstDocumentApi, catDocumentApi } from '@/features/document/infra/project-document-code-api'
import type {
  CcstAnalysisResponse,
  CcstAnalyzedLine,
  CcstAnalyzedLinePhoto,
  CcstPhotoType,
  CreateCcstDocumentRequest,
  CreateCcstDocumentResponse,
  DocumentJobResponse,
} from '@/features/document/model/document-types'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

type LotSlot = {
  id: number
  d7: { images: File[]; previewUrls: string[] }
  d28: { images: File[]; previewUrls: string[] }
}

type AgeDays = 7 | 28

const ccstPhotoTypeLabels: Record<CcstPhotoType, string> = {
  D7: '7일',
  D7_BOARD: '7일 보드',
  D28: '28일',
  D28_BOARD: '28일 보드',
}

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created', response: CreateCcstDocumentResponse): void
}>()

type Stage = 'input' | 'analyzing' | 'result' | 'submitting'

const stage = ref<Stage>('input')

// CAT doc selection
const catDocs = ref<DocumentJobResponse[]>([])
const isLoadingCatDocs = ref(false)
const selectedCatDocId = ref<string>('')

// Input stage — lots
const inputLots = ref<LotSlot[]>([
  {
    id: 1,
    d7: { images: [], previewUrls: [] },
    d28: { images: [], previewUrls: [] },
  },
])
let nextSlotId = 2

// Result stage
const result = ref<CcstAnalysisResponse | null>(null)

const totalLotImages = computed(() =>
  inputLots.value.reduce(
    (sum, l) => sum + l.d7.images.length + l.d28.images.length,
    0,
  ),
)

function revokeUrls(urls: string[]) {
  urls.forEach((u) => {
    if (u.startsWith('blob:')) URL.revokeObjectURL(u)
  })
}

function resetState() {
  inputLots.value.forEach((l) => {
    revokeUrls(l.d7.previewUrls)
    revokeUrls(l.d28.previewUrls)
  })
  selectedCatDocId.value = ''
  nextSlotId = 2
  inputLots.value = [
    {
      id: 1,
      d7: { images: [], previewUrls: [] },
      d28: { images: [], previewUrls: [] },
    },
  ]
  result.value = null
  stage.value = 'input'
}

async function loadCatDocs() {
  isLoadingCatDocs.value = true
  try {
    const list = await catDocumentApi.getCatDocumentList()
    catDocs.value = list.filter((d) => d.status === 'SUCCEEDED')
  } catch (error: unknown) {
    console.error('CAT 문서 목록 로드 실패:', error)
    catDocs.value = []
  } finally {
    isLoadingCatDocs.value = false
  }
}

watch(
  () => props.open,
  (opened) => {
    if (opened) {
      resetState()
      void loadCatDocs()
    }
  },
)

onMounted(() => {
  if (props.open) {
    void loadCatDocs()
  }
})

onUnmounted(() => {
  inputLots.value.forEach((l) => {
    revokeUrls(l.d7.previewUrls)
    revokeUrls(l.d28.previewUrls)
  })
})

function addLot() {
  inputLots.value = [
    ...inputLots.value,
    {
      id: nextSlotId++,
      d7: { images: [], previewUrls: [] },
      d28: { images: [], previewUrls: [] },
    },
  ]
}

function removeLot(idx: number) {
  if (inputLots.value.length <= 1) return
  const target = inputLots.value[idx]
  if (target) {
    revokeUrls(target.d7.previewUrls)
    revokeUrls(target.d28.previewUrls)
  }
  inputLots.value = inputLots.value.filter((_, i) => i !== idx)
}

function onLotImagesChange(idx: number, age: AgeDays, event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  if (imageFiles.length < files.length) {
    alert('이미지 파일만 업로드 가능합니다.')
  }
  inputLots.value = inputLots.value.map((l, i) => {
    if (i !== idx) return l
    const groupKey = age === 7 ? 'd7' : 'd28'
    revokeUrls(l[groupKey].previewUrls)
    return {
      ...l,
      [groupKey]: {
        images: imageFiles,
        previewUrls: imageFiles.map((f) => URL.createObjectURL(f)),
      },
    }
  })
  input.value = ''
}

async function handleAnalyze() {
  if (!selectedCatDocId.value) {
    alert('CAT 문서를 선택해주세요.')
    return
  }
  if (inputLots.value.length === 0) {
    alert('로트를 1개 이상 추가해주세요.')
    return
  }
  const emptyLotIdx = inputLots.value.findIndex(
    (l) => l.d7.images.length === 0 && l.d28.images.length === 0,
  )
  if (emptyLotIdx >= 0) {
    alert(`${emptyLotIdx + 1}로트에 7일 또는 28일 사진을 1장 이상 선택해주세요.`)
    return
  }

  const lots: { lot: number; ageDays: 7 | 28; images: File[] }[] = []
  inputLots.value.forEach((l, i) => {
    const lotNum = i + 1
    if (l.d7.images.length > 0) {
      lots.push({ lot: lotNum, ageDays: 7, images: l.d7.images })
    }
    if (l.d28.images.length > 0) {
      lots.push({ lot: lotNum, ageDays: 28, images: l.d28.images })
    }
  })

  stage.value = 'analyzing'
  try {
    const response = await ccstDocumentApi.analyzeCcstPhoto({
      catDocId: Number(selectedCatDocId.value),
      lots,
    })
    result.value = response
    stage.value = 'result'
    analyticsClient.trackAction('ccst_create', 'analyze', 'success')
  } catch (error: unknown) {
    console.error('CCST 분석 실패:', error)
    analyticsClient.trackAction('ccst_create', 'analyze', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
    stage.value = 'input'
  }
}

function generateLineKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function addLine() {
  if (!result.value) return
  const newLine: CcstAnalyzedLine = {
    lineKey: generateLineKey(),
    lot: 1,
    setNo: 1,
    ageDays: 7,
    comp1: null,
    comp2: null,
    comp3: null,
    testDate: null,
    photos: [],
  }
  result.value = {
    ...result.value,
    lines: [...result.value.lines, newLine],
  }
}

function removeLine(idx: number) {
  if (!result.value) return
  result.value = {
    ...result.value,
    lines: result.value.lines.filter((_, i) => i !== idx),
  }
}

function updatePhotoType(lineIdx: number, photoIdx: number, value: string) {
  if (!result.value) return
  const line = result.value.lines[lineIdx]
  if (!line) return
  const photo = line.photos[photoIdx]
  if (!photo) return
  line.photos[photoIdx] = { ...photo, type: value as CcstPhotoType }
}

async function handleValidate() {
  if (!result.value) return
  stage.value = 'submitting'
  try {
    const response = await ccstDocumentApi.updateCcstData(result.value)
    result.value = response
    stage.value = 'result'
    analyticsClient.trackAction('ccst_create', 'update_data', 'success')
  } catch (error: unknown) {
    console.error('CCST 업데이트 실패:', error)
    analyticsClient.trackAction('ccst_create', 'update_data', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
    stage.value = 'result'
  }
}

async function handleCreate() {
  if (!result.value) return
  if (result.value.lines.length === 0) {
    alert('라인을 1개 이상 입력해주세요.')
    return
  }
  stage.value = 'submitting'
  try {
    const body: CreateCcstDocumentRequest = {
      lines: result.value.lines.map((l) => ({
        lot: l.lot,
        setNo: l.setNo,
        ageDays: l.ageDays,
        comp1: l.comp1,
        comp2: l.comp2,
        comp3: l.comp3,
        testDate: l.testDate,
        photos: l.photos.map((p: CcstAnalyzedLinePhoto) => ({
          photoKey: p.photoKey,
          type: p.type,
          description: p.description,
        })),
      })),
    }
    const response = await ccstDocumentApi.createCcstDocument(result.value.catDocId, body)
    analyticsClient.trackAction('ccst_create', 'create_document', 'success')
    emit('created', response)
    emit('update:open', false)
  } catch (error: unknown) {
    console.error('CCST 문서 생성 실패:', error)
    analyticsClient.trackAction('ccst_create', 'create_document', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
    stage.value = 'result'
  }
}

const isBusy = computed(() => stage.value === 'analyzing' || stage.value === 'submitting')
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[820px]">
      <DialogHeader>
        <DialogTitle>콘크리트압축강도시험 생성</DialogTitle>
      </DialogHeader>

      <!-- Stage: input -->
      <div v-if="stage === 'input' || stage === 'analyzing'" class="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
        <div class="space-y-2">
          <Label>대상 CAT 문서</Label>
          <Select v-model="selectedCatDocId" :disabled="isBusy || isLoadingCatDocs">
            <SelectTrigger>
              <SelectValue
                :placeholder="isLoadingCatDocs ? 'CAT 문서 로딩 중...' : 'CAT 문서를 선택하세요'"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="doc in catDocs" :key="doc.id" :value="String(doc.id)">
                {{ doc.docNo ?? `문서 #${doc.id}` }} ({{ doc.createdAt.split('T')[0] }})
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="!isLoadingCatDocs && catDocs.length === 0" class="text-xs text-muted-foreground">
            생성된 CAT 문서가 없습니다. CAT 문서를 먼저 생성해주세요.
          </p>
        </div>

        <div class="space-y-3">
          <p class="text-xs text-muted-foreground">
            로트별로 7일 / 28일 압축강도 시험 사진을 분리해 업로드합니다.
          </p>
          <div
            v-for="(slot, idx) in inputLots"
            :key="slot.id"
            class="border border-border rounded-md p-3 space-y-3"
          >
            <div class="flex items-center justify-between">
              <Label class="text-sm font-semibold">{{ idx + 1 }}로트</Label>
              <Button
                v-if="inputLots.length > 1"
                variant="ghost"
                size="sm"
                class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                :disabled="isBusy"
                @click="removeLot(idx)"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
            <div class="space-y-2 pl-2 border-l-2 border-blue-300">
              <Label class="text-xs">7일 압축강도 사진</Label>
              <input
                type="file"
                multiple
                accept="image/*"
                class="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
                :disabled="isBusy"
                @change="onLotImagesChange(idx, 7, $event)"
              />
              <div v-if="slot.d7.images.length > 0" class="flex flex-wrap gap-2">
                <div
                  v-for="(_, fi) in slot.d7.images"
                  :key="fi"
                  class="w-[100px] h-[100px] rounded border border-border overflow-hidden"
                >
                  <img :src="slot.d7.previewUrls[fi]" class="w-full h-full object-cover" />
                </div>
              </div>
              <p class="text-xs text-muted-foreground">7일 사진 {{ slot.d7.images.length }}장</p>
            </div>
            <div class="space-y-2 pl-2 border-l-2 border-amber-300">
              <Label class="text-xs">28일 압축강도 사진</Label>
              <input
                type="file"
                multiple
                accept="image/*"
                class="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
                :disabled="isBusy"
                @change="onLotImagesChange(idx, 28, $event)"
              />
              <div v-if="slot.d28.images.length > 0" class="flex flex-wrap gap-2">
                <div
                  v-for="(_, fi) in slot.d28.images"
                  :key="fi"
                  class="w-[100px] h-[100px] rounded border border-border overflow-hidden"
                >
                  <img :src="slot.d28.previewUrls[fi]" class="w-full h-full object-cover" />
                </div>
              </div>
              <p class="text-xs text-muted-foreground">28일 사진 {{ slot.d28.images.length }}장</p>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <Button variant="outline" size="sm" :disabled="isBusy" @click="addLot">+ 로트 추가</Button>
            <p class="text-xs text-muted-foreground">전체 선택 {{ totalLotImages }}장</p>
          </div>
        </div>
      </div>

      <!-- Stage: result -->
      <div v-else-if="result" class="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
        <div class="text-xs text-muted-foreground">CAT 문서 #{{ result.catDocId }}</div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-semibold">라인</Label>
            <Button variant="outline" size="sm" :disabled="isBusy" @click="addLine">+ 행 추가</Button>
          </div>
          <div class="overflow-x-auto border border-border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[60px]">로트</TableHead>
                  <TableHead class="w-[60px]">세트</TableHead>
                  <TableHead class="w-[80px]">재령</TableHead>
                  <TableHead>comp1</TableHead>
                  <TableHead>comp2</TableHead>
                  <TableHead>comp3</TableHead>
                  <TableHead>시험일</TableHead>
                  <TableHead class="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(line, idx) in result.lines" :key="line.lineKey">
                  <TableCell>
                    <Input
                      type="number"
                      :model-value="line.lot"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.lot = Number($event) || 1"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      :model-value="line.setNo"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.setNo = Number($event) || 1"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      :model-value="String(line.ageDays)"
                      @update:model-value="line.ageDays = Number($event) === 7 ? 7 : 28"
                    >
                      <SelectTrigger class="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7일</SelectItem>
                        <SelectItem value="28">28일</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      :model-value="line.comp1 ?? ''"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.comp1 = $event === '' ? null : Number($event)"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      :model-value="line.comp2 ?? ''"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.comp2 = $event === '' ? null : Number($event)"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      :model-value="line.comp3 ?? ''"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.comp3 = $event === '' ? null : Number($event)"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      :model-value="line.testDate ?? ''"
                      type="date"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.testDate = ($event as string) || null"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      :disabled="isBusy"
                      @click="removeLine(idx)"
                    >
                      <X class="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div class="space-y-3">
          <Label class="text-sm font-semibold">사진</Label>
          <div
            v-for="(line, lineIdx) in result.lines"
            :key="`photos-${line.lineKey}`"
            class="border border-border rounded-md p-3 space-y-2"
          >
            <div class="text-sm font-semibold">
              {{ line.lot }}로트 · {{ line.setNo }}세트 · {{ line.ageDays }}일
            </div>
            <div v-if="line.photos.length === 0" class="text-xs text-muted-foreground">
              사진이 없습니다.
            </div>
            <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div
                v-for="(photo, photoIdx) in line.photos"
                :key="photo.photoKey"
                class="border border-border rounded-md p-2 space-y-1.5"
              >
                <img
                  :src="`data:${photo.mimeType};base64,${photo.data}`"
                  class="w-full h-[120px] object-cover rounded"
                />
                <Select
                  :model-value="photo.type"
                  @update:model-value="updatePhotoType(lineIdx, photoIdx, $event as string)"
                >
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="(label, key) in ccstPhotoTypeLabels" :key="key" :value="key">
                      {{ label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  :model-value="photo.description ?? ''"
                  placeholder="사진 설명"
                  class="h-8 text-xs"
                  :disabled="isBusy"
                  @update:model-value="photo.description = ($event as string) || null"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="flex-col items-end gap-2">
        <div v-if="stage === 'input' || stage === 'analyzing'" class="flex gap-2">
          <Button variant="outline" :disabled="isBusy" @click="emit('update:open', false)">취소</Button>
          <Button :disabled="isBusy || !selectedCatDocId || totalLotImages === 0" @click="handleAnalyze">
            {{ stage === 'analyzing' ? '분석 중...' : '분석' }}
          </Button>
        </div>
        <div v-else class="flex gap-2">
          <Button variant="outline" :disabled="isBusy" @click="emit('update:open', false)">취소</Button>
          <Button variant="outline" :disabled="isBusy" @click="handleValidate">
            {{ stage === 'submitting' ? '처리 중...' : '검증' }}
          </Button>
          <Button :disabled="isBusy" @click="handleCreate">
            {{ stage === 'submitting' ? '생성 중...' : '문서 생성' }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
