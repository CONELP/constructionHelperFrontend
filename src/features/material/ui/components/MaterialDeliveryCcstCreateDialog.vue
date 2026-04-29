<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import { X } from 'lucide-vue-next'
import { materialOrderApi } from '@/features/material/infra/material-order-api'
import type {
  CreateCcstBatchInput,
  CreateCcstResponse,
} from '@/features/material/model/material-order-types'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

type AgeDays = 7 | 28

type AgeGroup = {
  images: File[]
  previewUrls: string[]
}

type BatchSlot = {
  id: number
  d7: AgeGroup
  d28: AgeGroup
}

const props = defineProps<{
  open: boolean
  materialDeliveryId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submitted', deliveryId: number, result: CreateCcstResponse): void
}>()

const isSaving = ref(false)
const batches = ref<BatchSlot[]>([
  { id: 1, d7: { images: [], previewUrls: [] }, d28: { images: [], previewUrls: [] } },
])
let nextSlotId = 2

const totalImages = computed(() =>
  batches.value.reduce((sum, b) => sum + b.d7.images.length + b.d28.images.length, 0),
)

function revokeUrls(urls: string[]) {
  urls.forEach((u) => {
    if (u.startsWith('blob:')) URL.revokeObjectURL(u)
  })
}

function buildPreviewUrls(files: File[]): string[] {
  return files.map((f) => URL.createObjectURL(f))
}

function resetBatches() {
  batches.value.forEach((b) => {
    revokeUrls(b.d7.previewUrls)
    revokeUrls(b.d28.previewUrls)
  })
  nextSlotId = 2
  batches.value = [
    { id: 1, d7: { images: [], previewUrls: [] }, d28: { images: [], previewUrls: [] } },
  ]
}

watch(
  () => props.open,
  (opened) => {
    if (opened) {
      resetBatches()
    }
  },
)

onUnmounted(() => {
  batches.value.forEach((b) => {
    revokeUrls(b.d7.previewUrls)
    revokeUrls(b.d28.previewUrls)
  })
})

function addBatch() {
  batches.value = [
    ...batches.value,
    {
      id: nextSlotId++,
      d7: { images: [], previewUrls: [] },
      d28: { images: [], previewUrls: [] },
    },
  ]
}

function removeBatch(idx: number) {
  if (batches.value.length <= 1) return
  const target = batches.value[idx]
  if (target) {
    revokeUrls(target.d7.previewUrls)
    revokeUrls(target.d28.previewUrls)
  }
  batches.value = batches.value.filter((_, i) => i !== idx)
}

function onImagesChange(idx: number, age: AgeDays, event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  if (imageFiles.length < files.length) {
    alert('이미지 파일만 업로드 가능합니다.')
  }
  batches.value = batches.value.map((b, i) => {
    if (i !== idx) return b
    const groupKey = age === 7 ? 'd7' : 'd28'
    revokeUrls(b[groupKey].previewUrls)
    return {
      ...b,
      [groupKey]: {
        images: imageFiles,
        previewUrls: buildPreviewUrls(imageFiles),
      },
    }
  })
  input.value = ''
}

function removeImage(idx: number, age: AgeDays, fi: number) {
  batches.value = batches.value.map((b, i) => {
    if (i !== idx) return b
    const groupKey = age === 7 ? 'd7' : 'd28'
    const group = b[groupKey]
    const oldUrl = group.previewUrls[fi]
    if (oldUrl) revokeUrls([oldUrl])
    return {
      ...b,
      [groupKey]: {
        images: group.images.filter((_, j) => j !== fi),
        previewUrls: group.previewUrls.filter((_, j) => j !== fi),
      },
    }
  })
}

async function handleSave() {
  if (props.materialDeliveryId == null) return
  if (batches.value.length === 0) {
    alert('회차를 1개 이상 추가해주세요.')
    return
  }
  const emptyBatchIdx = batches.value.findIndex(
    (b) => b.d7.images.length === 0 && b.d28.images.length === 0,
  )
  if (emptyBatchIdx >= 0) {
    alert(`${emptyBatchIdx + 1}회차에 7일 또는 28일 사진을 1장 이상 선택해주세요.`)
    return
  }

  const groups: CreateCcstBatchInput[] = []
  batches.value.forEach((b, i) => {
    const batchNum = i + 1
    if (b.d7.images.length > 0) {
      groups.push({ batch: batchNum, ageDays: 7, images: b.d7.images })
    }
    if (b.d28.images.length > 0) {
      groups.push({ batch: batchNum, ageDays: 28, images: b.d28.images })
    }
  })

  isSaving.value = true
  try {
    const result = await materialOrderApi.createCcstLine(
      props.materialDeliveryId,
      groups,
    )
    analyticsClient.trackAction('material_delivery', 'create_ccst', 'success')
    emit('submitted', props.materialDeliveryId, result)
    emit('update:open', false)
  } catch (error: unknown) {
    console.error('콘크리트압축강도시험 생성 실패:', error)
    analyticsClient.trackAction('material_delivery', 'create_ccst', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>콘크리트압축강도시험 생성</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
        <p class="text-xs text-muted-foreground">
          회차별로 7일 / 28일 압축강도 시험 사진을 분리해 업로드합니다.
        </p>

        <div
          v-for="(slot, idx) in batches"
          :key="slot.id"
          class="border border-border rounded-md p-3 space-y-3"
        >
          <div class="flex items-center justify-between">
            <Label class="text-sm font-semibold">{{ idx + 1 }}회차</Label>
            <Button
              v-if="batches.length > 1"
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              :disabled="isSaving"
              @click="removeBatch(idx)"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>

          <!-- 7일 사진 -->
          <div class="space-y-2 pl-2 border-l-2 border-blue-300">
            <Label class="text-xs">7일 압축강도 사진</Label>
            <input
              type="file"
              multiple
              accept="image/*"
              class="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
              :disabled="isSaving"
              @change="onImagesChange(idx, 7, $event)"
            />
            <div v-if="slot.d7.images.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="(_, fi) in slot.d7.images"
                :key="fi"
                class="relative w-[100px] h-[100px] rounded border border-border overflow-hidden group"
              >
                <img
                  :src="slot.d7.previewUrls[fi]"
                  class="w-full h-full object-cover"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="removeImage(idx, 7, fi)"
                >
                  ✕
                </button>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              7일 사진 {{ slot.d7.images.length }}장
            </p>
          </div>

          <!-- 28일 사진 -->
          <div class="space-y-2 pl-2 border-l-2 border-amber-300">
            <Label class="text-xs">28일 압축강도 사진</Label>
            <input
              type="file"
              multiple
              accept="image/*"
              class="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
              :disabled="isSaving"
              @change="onImagesChange(idx, 28, $event)"
            />
            <div v-if="slot.d28.images.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="(_, fi) in slot.d28.images"
                :key="fi"
                class="relative w-[100px] h-[100px] rounded border border-border overflow-hidden group"
              >
                <img
                  :src="slot.d28.previewUrls[fi]"
                  class="w-full h-full object-cover"
                />
                <button
                  type="button"
                  class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="removeImage(idx, 28, fi)"
                >
                  ✕
                </button>
              </div>
            </div>
            <p class="text-xs text-muted-foreground">
              28일 사진 {{ slot.d28.images.length }}장
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            :disabled="isSaving"
            @click="addBatch"
          >
            + 회차 추가
          </Button>
          <p class="text-xs text-muted-foreground">
            전체 선택 {{ totalImages }}장
          </p>
        </div>
      </div>

      <DialogFooter class="flex-col items-end gap-2">
        <div class="flex gap-2">
          <Button
            variant="outline"
            :disabled="isSaving"
            @click="emit('update:open', false)"
          >
            취소
          </Button>
          <Button
            :disabled="isSaving || totalImages === 0 || materialDeliveryId == null"
            @click="handleSave"
          >
            {{ isSaving ? '생성 중...' : '생성' }}
          </Button>
        </div>
        <p v-if="isSaving" class="text-sm text-muted-foreground">
          사진 분석에 시간이 걸릴 수 있습니다. 기다려주세요.
        </p>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
