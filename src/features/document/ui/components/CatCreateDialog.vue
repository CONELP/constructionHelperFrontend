<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
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
import { catDocumentApi } from '@/features/document/infra/project-document-code-api'
import type {
  CatAnalysisResponse,
  CatAnalyzedBatch,
  CatAnalyzedBatchPhoto,
  CatPhotoType,
  CreateCatDocumentRequest,
  CreateCatDocumentResponse,
  MirAnalyzedLine,
  MirAnalyzedPhoto,
  MirPhotoType,
} from '@/features/document/model/document-types'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

const MAX_DELIVERY_NOTE_IMAGES = 10
const MAX_BATCH_IMAGES = 10

const mirPhotoTypeLabels: Record<MirPhotoType, string> = {
  DELIVERY_NOTE: '송장',
  MILL_SHEET: '밀시트',
  TAG: '태그',
  DELIVERY_PHOTO: '반입사진',
}

const catPhotoTypeLabels: Record<CatPhotoType, string> = {
  SLUMP: '슬럼프',
  AIR: '공기량',
  TEMPERATURE: '온도',
  CHLORIDE: '염화물',
  WATER: '단위수량',
  OVERVIEW: '전경',
  TEST_BOARD: '시험보드',
}

type BatchSlot = {
  id: number
  images: File[]
  previewUrls: string[]
}

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created', response: CreateCatDocumentResponse): void
}>()

type Stage = 'input' | 'analyzing' | 'result' | 'submitting'

const stage = ref<Stage>('input')

// Input stage
const inputApplication = ref('')
const inputWorkTypeName = ref('')
const inputDeliveryNoteImages = ref<File[]>([])
const inputDeliveryNotePreviewUrls = ref<string[]>([])
const inputBatches = ref<BatchSlot[]>([{ id: 1, images: [], previewUrls: [] }])
let nextSlotId = 2

// Result stage
const result = ref<CatAnalysisResponse | null>(null)
const newWorkTypeName = ref('')
const newMaterialTypeName = ref('')
const newMaterialSpecName = ref('')

const totalBatchImages = computed(() =>
  inputBatches.value.reduce((sum, b) => sum + b.images.length, 0),
)

function revokeUrls(urls: string[]) {
  urls.forEach((u) => {
    if (u.startsWith('blob:')) URL.revokeObjectURL(u)
  })
}

function resetState() {
  revokeUrls(inputDeliveryNotePreviewUrls.value)
  inputBatches.value.forEach((b) => revokeUrls(b.previewUrls))
  inputApplication.value = ''
  inputWorkTypeName.value = ''
  inputDeliveryNoteImages.value = []
  inputDeliveryNotePreviewUrls.value = []
  nextSlotId = 2
  inputBatches.value = [{ id: 1, images: [], previewUrls: [] }]
  result.value = null
  newWorkTypeName.value = ''
  newMaterialTypeName.value = ''
  newMaterialSpecName.value = ''
  stage.value = 'input'
}

watch(
  () => props.open,
  (opened) => {
    if (opened) resetState()
  },
)

onUnmounted(() => {
  revokeUrls(inputDeliveryNotePreviewUrls.value)
  inputBatches.value.forEach((b) => revokeUrls(b.previewUrls))
})

function onDeliveryNoteImagesChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  if (imageFiles.length < files.length) {
    alert('이미지 파일만 업로드 가능합니다.')
  }
  revokeUrls(inputDeliveryNotePreviewUrls.value)
  const limited = imageFiles.slice(0, MAX_DELIVERY_NOTE_IMAGES)
  inputDeliveryNoteImages.value = limited
  inputDeliveryNotePreviewUrls.value = limited.map((f) => URL.createObjectURL(f))
  input.value = ''
}

function removeDeliveryNoteImage(index: number) {
  const url = inputDeliveryNotePreviewUrls.value[index]
  if (url) revokeUrls([url])
  inputDeliveryNoteImages.value = inputDeliveryNoteImages.value.filter((_, i) => i !== index)
  inputDeliveryNotePreviewUrls.value = inputDeliveryNotePreviewUrls.value.filter(
    (_, i) => i !== index,
  )
}

function addInputBatch() {
  inputBatches.value = [
    ...inputBatches.value,
    { id: nextSlotId++, images: [], previewUrls: [] },
  ]
}

function removeInputBatch(idx: number) {
  if (inputBatches.value.length <= 1) return
  const target = inputBatches.value[idx]
  if (target) revokeUrls(target.previewUrls)
  inputBatches.value = inputBatches.value.filter((_, i) => i !== idx)
}

function onBatchImagesChange(idx: number, event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  if (imageFiles.length < files.length) {
    alert('이미지 파일만 업로드 가능합니다.')
  }
  if (imageFiles.length > MAX_BATCH_IMAGES) {
    alert(`회차당 사진은 최대 ${MAX_BATCH_IMAGES}장까지 업로드 가능합니다.`)
  }
  const limited = imageFiles.slice(0, MAX_BATCH_IMAGES)
  inputBatches.value = inputBatches.value.map((b, i) => {
    if (i !== idx) return b
    revokeUrls(b.previewUrls)
    return {
      ...b,
      images: limited,
      previewUrls: limited.map((f) => URL.createObjectURL(f)),
    }
  })
  input.value = ''
}

async function handleAnalyze() {
  if (inputDeliveryNoteImages.value.length === 0) {
    alert('송장/밀시트/태그/현장 사진을 1장 이상 선택해주세요.')
    return
  }
  if (inputBatches.value.length === 0) {
    alert('회차를 1개 이상 추가해주세요.')
    return
  }
  const emptyIdx = inputBatches.value.findIndex((b) => b.images.length === 0)
  if (emptyIdx >= 0) {
    alert(`${emptyIdx + 1}회차에 사진을 1장 이상 선택해주세요.`)
    return
  }
  stage.value = 'analyzing'
  try {
    const response = await catDocumentApi.analyzeCatPhoto({
      deliveryNoteImages: inputDeliveryNoteImages.value,
      batches: inputBatches.value.map((b, i) => ({ batch: i + 1, images: b.images })),
      application: inputApplication.value.trim() || undefined,
      workTypeName: inputWorkTypeName.value.trim() || undefined,
    })
    result.value = response
    stage.value = 'result'
    analyticsClient.trackAction('cat_create', 'analyze', 'success')
  } catch (error: unknown) {
    console.error('CAT 분석 실패:', error)
    analyticsClient.trackAction('cat_create', 'analyze', 'fail')
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
  const newLine: MirAnalyzedLine = {
    lineKey: generateLineKey(),
    manufacturer: null,
    materialSpecId: null,
    materialSpecName: null,
    materialTypeId: null,
    materialTypeName: null,
    quantity: '0',
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

function nextBatchNumber(): number {
  if (!result.value || result.value.batches.length === 0) return 1
  return Math.max(...result.value.batches.map((b) => b.batch)) + 1
}

function addBatch() {
  if (!result.value) return
  const newBatch: CatAnalyzedBatch = {
    batch: nextBatchNumber(),
    lineData: { slump: null, air: null, temp: null, chloride: null, water: null },
    photos: [],
  }
  result.value = {
    ...result.value,
    batches: [...result.value.batches, newBatch],
  }
}

function removeBatch(idx: number) {
  if (!result.value) return
  result.value = {
    ...result.value,
    batches: result.value.batches.filter((_, i) => i !== idx),
  }
}

function updateMirPhotoType(idx: number, value: string) {
  if (!result.value) return
  const photo = result.value.photos[idx]
  if (!photo) return
  result.value.photos[idx] = { ...photo, type: value as MirPhotoType }
}

function updateBatchPhotoType(batchIdx: number, photoIdx: number, value: string) {
  if (!result.value) return
  const batch = result.value.batches[batchIdx]
  if (!batch) return
  const photo = batch.photos[photoIdx]
  if (!photo) return
  batch.photos[photoIdx] = { ...photo, type: value as CatPhotoType }
}

async function handleValidate() {
  if (!result.value) return
  stage.value = 'submitting'
  try {
    const response = await catDocumentApi.updateCatData({
      ...result.value,
      newWorkTypeName: newWorkTypeName.value.trim() || undefined,
      newMaterialTypeName: newMaterialTypeName.value.trim() || undefined,
      newMaterialSpecName: newMaterialSpecName.value.trim() || undefined,
    })
    result.value = response
    newWorkTypeName.value = ''
    newMaterialTypeName.value = ''
    newMaterialSpecName.value = ''
    stage.value = 'result'
    analyticsClient.trackAction('cat_create', 'update_data', 'success')
  } catch (error: unknown) {
    console.error('CAT 업데이트 실패:', error)
    analyticsClient.trackAction('cat_create', 'update_data', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
    stage.value = 'result'
  }
}

async function handleCreate() {
  if (!result.value) return
  if (result.value.workTypeId == null) {
    alert('공종이 매칭되지 않았습니다. 검증을 먼저 실행해주세요.')
    return
  }
  if (result.value.lines.length === 0) {
    alert('자재 라인을 1개 이상 입력해주세요.')
    return
  }
  stage.value = 'submitting'
  try {
    const body: CreateCatDocumentRequest = {
      application: result.value.application,
      supplier: result.value.supplier,
      deliveryDate: result.value.deliveryDate,
      workTypeId: result.value.workTypeId,
      lines: result.value.lines.map((l) => ({
        manufacturer: l.manufacturer,
        materialSpecId: l.materialSpecId,
        quantity: l.quantity,
      })),
      photos: result.value.photos.map((p: MirAnalyzedPhoto) => ({
        photoKey: p.photoKey,
        type: p.type,
        description: p.description,
      })),
      batches: result.value.batches.map((b) => ({
        batch: b.batch,
        lineData: b.lineData,
        photos: b.photos.map((p: CatAnalyzedBatchPhoto) => ({
          photoKey: p.photoKey,
          type: p.type,
          description: p.description,
        })),
      })),
    }
    const response = await catDocumentApi.createCatDocument(body)
    analyticsClient.trackAction('cat_create', 'create_document', 'success')
    emit('created', response)
    emit('update:open', false)
  } catch (error: unknown) {
    console.error('CAT 문서 생성 실패:', error)
    analyticsClient.trackAction('cat_create', 'create_document', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
    stage.value = 'result'
  }
}

const isBusy = computed(() => stage.value === 'analyzing' || stage.value === 'submitting')
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[860px]">
      <DialogHeader>
        <DialogTitle>콘크리트받아들이기시험 생성</DialogTitle>
      </DialogHeader>

      <!-- Stage: input -->
      <div v-if="stage === 'input' || stage === 'analyzing'" class="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <Label>송장·밀시트·태그·현장 사진</Label>
            <span class="text-xs text-muted-foreground">
              1~{{ MAX_DELIVERY_NOTE_IMAGES }}장, 다시 선택 시 교체
            </span>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            class="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
            :disabled="isBusy"
            @change="onDeliveryNoteImagesChange"
          />
          <div v-if="inputDeliveryNoteImages.length > 0" class="flex flex-wrap gap-2 mt-1">
            <div
              v-for="(_, i) in inputDeliveryNoteImages"
              :key="i"
              class="relative w-[120px] h-[120px] rounded border border-border overflow-hidden group"
            >
              <img :src="inputDeliveryNotePreviewUrls[i]" class="w-full h-full object-cover" />
              <button
                type="button"
                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                @click="removeDeliveryNoteImage(i)"
              >
                ✕
              </button>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            선택 {{ inputDeliveryNoteImages.length }} / {{ MAX_DELIVERY_NOTE_IMAGES }}장
          </p>
        </div>

        <div class="space-y-2">
          <Label>사용부위</Label>
          <Input v-model="inputApplication" placeholder="예: 지하1층 기둥" :disabled="isBusy" />
        </div>

        <div class="space-y-2">
          <Label>공종</Label>
          <Input v-model="inputWorkTypeName" placeholder="콘크리트공사" :disabled="isBusy" />
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-semibold">회차별 시험 사진</Label>
            <p class="text-xs text-muted-foreground">전체 선택 {{ totalBatchImages }}장</p>
          </div>
          <div
            v-for="(slot, idx) in inputBatches"
            :key="slot.id"
            class="border border-border rounded-md p-3 space-y-2"
          >
            <div class="flex items-center justify-between">
              <Label>{{ idx + 1 }}회차</Label>
              <Button
                v-if="inputBatches.length > 1"
                variant="ghost"
                size="sm"
                class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                :disabled="isBusy"
                @click="removeInputBatch(idx)"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
            <input
              type="file"
              multiple
              accept="image/*"
              class="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
              :disabled="isBusy"
              @change="onBatchImagesChange(idx, $event)"
            />
            <div v-if="slot.images.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="(_, fi) in slot.images"
                :key="fi"
                class="w-[100px] h-[100px] rounded border border-border overflow-hidden"
              >
                <img :src="slot.previewUrls[fi]" class="w-full h-full object-cover" />
              </div>
            </div>
            <p class="text-xs text-muted-foreground">이 회차 사진 {{ slot.images.length }}장</p>
          </div>
          <Button variant="outline" size="sm" :disabled="isBusy" @click="addInputBatch">
            + 회차 추가
          </Button>
        </div>
      </div>

      <!-- Stage: result -->
      <div v-else-if="result" class="space-y-5 py-2 max-h-[70vh] overflow-y-auto">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label>공급업체</Label>
            <Input v-model="result.supplier" :disabled="isBusy" />
          </div>
          <div class="space-y-1.5">
            <Label>납품일</Label>
            <Input v-model="result.deliveryDate" type="date" :disabled="isBusy" />
          </div>
        </div>
        <div class="space-y-1.5">
          <Label>사용부위</Label>
          <Input
            :model-value="result.application ?? ''"
            :disabled="isBusy"
            @update:model-value="result && (result.application = ($event as string) || null)"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label>공종 (분석)</Label>
            <Input :model-value="result.workTypeName ?? ''" :disabled="true" placeholder="-" />
          </div>
          <div class="space-y-1.5">
            <Label>공종 변경</Label>
            <Input v-model="newWorkTypeName" placeholder="newWorkTypeName" :disabled="isBusy" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label>자재유형 변경</Label>
            <Input v-model="newMaterialTypeName" :disabled="isBusy" />
          </div>
          <div class="space-y-1.5">
            <Label>자재규격 변경</Label>
            <Input v-model="newMaterialSpecName" :disabled="isBusy" />
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-semibold">라인</Label>
            <Button variant="outline" size="sm" :disabled="isBusy" @click="addLine">+ 행 추가</Button>
          </div>
          <div class="overflow-x-auto border border-border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제조사</TableHead>
                  <TableHead>자재규격</TableHead>
                  <TableHead>자재유형</TableHead>
                  <TableHead class="w-[120px] text-right">수량</TableHead>
                  <TableHead class="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(line, idx) in result.lines" :key="line.lineKey">
                  <TableCell>
                    <Input
                      :model-value="line.manufacturer ?? ''"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.manufacturer = ($event as string) || null"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      :model-value="line.materialSpecName ?? ''"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.materialSpecName = ($event as string) || null"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      :model-value="line.materialTypeName ?? ''"
                      class="h-8 text-sm"
                      :disabled="isBusy"
                      @update:model-value="line.materialTypeName = ($event as string) || null"
                    />
                  </TableCell>
                  <TableCell>
                    <Input v-model="line.quantity" class="h-8 text-sm text-right" :disabled="isBusy" />
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

        <div class="space-y-2">
          <Label class="text-sm font-semibold">자재 사진</Label>
          <div v-if="result.photos.length === 0" class="text-sm text-muted-foreground">
            분석된 사진이 없습니다.
          </div>
          <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div
              v-for="(photo, idx) in result.photos"
              :key="photo.photoKey"
              class="border border-border rounded-md p-2 space-y-1.5"
            >
              <img
                :src="`data:${photo.mimeType};base64,${photo.data}`"
                class="w-full h-[160px] object-cover rounded"
              />
              <Select
                :model-value="photo.type"
                @update:model-value="updateMirPhotoType(idx, $event as string)"
              >
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="(label, key) in mirPhotoTypeLabels" :key="key" :value="key">
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

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <Label class="text-sm font-semibold">회차</Label>
            <Button variant="outline" size="sm" :disabled="isBusy" @click="addBatch">+ 회차 추가</Button>
          </div>
          <div
            v-for="(batch, batchIdx) in result.batches"
            :key="`batch-${batch.batch}`"
            class="border border-border rounded-md p-3 space-y-3"
          >
            <div class="flex items-center justify-between">
              <Label class="text-sm font-semibold">{{ batch.batch }}회차</Label>
              <Button
                variant="ghost"
                size="sm"
                class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                :disabled="isBusy"
                @click="removeBatch(batchIdx)"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
            <div class="grid grid-cols-5 gap-2">
              <div class="space-y-1">
                <Label class="text-xs">슬럼프</Label>
                <Input
                  type="number"
                  :model-value="batch.lineData.slump ?? ''"
                  class="h-8 text-sm"
                  :disabled="isBusy"
                  @update:model-value="batch.lineData.slump = $event === '' ? null : Number($event)"
                />
              </div>
              <div class="space-y-1">
                <Label class="text-xs">공기량</Label>
                <Input
                  type="number"
                  :model-value="batch.lineData.air ?? ''"
                  class="h-8 text-sm"
                  :disabled="isBusy"
                  @update:model-value="batch.lineData.air = $event === '' ? null : Number($event)"
                />
              </div>
              <div class="space-y-1">
                <Label class="text-xs">온도</Label>
                <Input
                  type="number"
                  :model-value="batch.lineData.temp ?? ''"
                  class="h-8 text-sm"
                  :disabled="isBusy"
                  @update:model-value="batch.lineData.temp = $event === '' ? null : Number($event)"
                />
              </div>
              <div class="space-y-1">
                <Label class="text-xs">염화물</Label>
                <Input
                  type="number"
                  :model-value="batch.lineData.chloride ?? ''"
                  class="h-8 text-sm"
                  :disabled="isBusy"
                  @update:model-value="batch.lineData.chloride = $event === '' ? null : Number($event)"
                />
              </div>
              <div class="space-y-1">
                <Label class="text-xs">단위수량</Label>
                <Input
                  type="number"
                  :model-value="batch.lineData.water ?? ''"
                  class="h-8 text-sm"
                  :disabled="isBusy"
                  @update:model-value="batch.lineData.water = $event === '' ? null : Number($event)"
                />
              </div>
            </div>
            <div v-if="batch.photos.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div
                v-for="(photo, photoIdx) in batch.photos"
                :key="photo.photoKey"
                class="border border-border rounded-md p-2 space-y-1.5"
              >
                <img
                  :src="`data:${photo.mimeType};base64,${photo.data}`"
                  class="w-full h-[120px] object-cover rounded"
                />
                <Select
                  :model-value="photo.type"
                  @update:model-value="updateBatchPhotoType(batchIdx, photoIdx, $event as string)"
                >
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="(label, key) in catPhotoTypeLabels" :key="key" :value="key">
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
            <p v-else class="text-xs text-muted-foreground">사진이 없습니다.</p>
          </div>
        </div>
      </div>

      <DialogFooter class="flex-col items-end gap-2">
        <div v-if="stage === 'input' || stage === 'analyzing'" class="flex gap-2">
          <Button variant="outline" :disabled="isBusy" @click="emit('update:open', false)">취소</Button>
          <Button
            :disabled="isBusy || inputDeliveryNoteImages.length === 0 || totalBatchImages === 0"
            @click="handleAnalyze"
          >
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
