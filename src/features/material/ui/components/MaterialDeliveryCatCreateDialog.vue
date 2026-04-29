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
import type { CreateCatResponse } from '@/features/material/model/material-order-types'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

type BatchSlot = {
  id: number
  images: File[]
  previewUrls: string[]
}

const props = defineProps<{
  open: boolean
  materialDeliveryId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'submitted', deliveryId: number, result: CreateCatResponse): void
}>()

const isSaving = ref(false)
const batches = ref<BatchSlot[]>([{ id: 1, images: [], previewUrls: [] }])
let nextSlotId = 2

const totalImages = computed(() =>
  batches.value.reduce((sum, b) => sum + b.images.length, 0),
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
  batches.value.forEach((b) => revokeUrls(b.previewUrls))
  nextSlotId = 2
  batches.value = [{ id: 1, images: [], previewUrls: [] }]
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
  batches.value.forEach((b) => revokeUrls(b.previewUrls))
})

function addBatch() {
  batches.value = [
    ...batches.value,
    { id: nextSlotId++, images: [], previewUrls: [] },
  ]
}

function removeBatch(idx: number) {
  if (batches.value.length <= 1) return
  const target = batches.value[idx]
  if (target) revokeUrls(target.previewUrls)
  batches.value = batches.value.filter((_, i) => i !== idx)
}

function onImagesChange(idx: number, event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  const imageFiles = files.filter((f) => f.type.startsWith('image/'))
  if (imageFiles.length < files.length) {
    alert('이미지 파일만 업로드 가능합니다.')
  }
  batches.value = batches.value.map((b, i) => {
    if (i !== idx) return b
    revokeUrls(b.previewUrls)
    return {
      ...b,
      images: imageFiles,
      previewUrls: buildPreviewUrls(imageFiles),
    }
  })
  input.value = ''
}

function removeImage(idx: number, fi: number) {
  batches.value = batches.value.map((b, i) => {
    if (i !== idx) return b
    const oldUrl = b.previewUrls[fi]
    if (oldUrl) revokeUrls([oldUrl])
    return {
      ...b,
      images: b.images.filter((_, j) => j !== fi),
      previewUrls: b.previewUrls.filter((_, j) => j !== fi),
    }
  })
}

async function handleSave() {
  if (props.materialDeliveryId == null) return
  if (batches.value.length === 0) {
    alert('회차를 1개 이상 추가해주세요.')
    return
  }
  const emptyIdx = batches.value.findIndex((b) => b.images.length === 0)
  if (emptyIdx >= 0) {
    alert(`${emptyIdx + 1}회차에 사진을 1장 이상 선택해주세요.`)
    return
  }

  isSaving.value = true
  try {
    const result = await materialOrderApi.createCat(
      props.materialDeliveryId,
      batches.value.map((b, i) => ({ batch: i + 1, images: b.images })),
    )
    analyticsClient.trackAction('material_delivery', 'create_cat', 'success')
    emit('submitted', props.materialDeliveryId, result)
    emit('update:open', false)
  } catch (error: unknown) {
    console.error('콘크리트받아들이기시험 생성 실패:', error)
    analyticsClient.trackAction('material_delivery', 'create_cat', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>콘크리트받아들이기시험 생성</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
        <p class="text-xs text-muted-foreground">
          회차별로 사진을 묶어 업로드합니다.
        </p>

        <div
          v-for="(slot, idx) in batches"
          :key="slot.id"
          class="border border-border rounded-md p-3 space-y-2"
        >
          <div class="flex items-center justify-between">
            <Label>{{ idx + 1 }}회차</Label>
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
          <input
            type="file"
            multiple
            accept="image/*"
            class="block w-full text-sm text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-sm file:font-medium hover:file:bg-muted/80 cursor-pointer"
            :disabled="isSaving"
            @change="onImagesChange(idx, $event)"
          />
          <div v-if="slot.images.length > 0" class="flex flex-wrap gap-2">
            <div
              v-for="(_, fi) in slot.images"
              :key="fi"
              class="relative w-[100px] h-[100px] rounded border border-border overflow-hidden group"
            >
              <img
                :src="slot.previewUrls[fi]"
                class="w-full h-full object-cover"
              />
              <button
                type="button"
                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                @click="removeImage(idx, fi)"
              >
                ✕
              </button>
            </div>
          </div>
          <p class="text-xs text-muted-foreground">
            이 회차 사진 {{ slot.images.length }}장
          </p>
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
