<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Button } from '@/shared/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { X } from 'lucide-vue-next'
import { materialOrderApi } from '@/features/material/infra/material-order-api'
import {
  catDocumentApi,
  ccstDocumentApi,
} from '@/features/document/infra/project-document-code-api'
import type {
  CatLineResponse,
  CcstLineResponse,
  MaterialDeliveryDetail,
  PhotoType,
} from '@/features/material/model/material-order-types'
import { fileApi } from '@/shared/network-core/apis/file'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

const props = defineProps<{
  materialDeliveryId: number
  initialDeliveryDate?: string
  initialMaterialTypeName?: string
  initialUnit?: string
  initialMirDocumentNumber?: string | null
  initialCatDocumentNumber?: string | null
  initialCcstDocumentNumber?: string | null
}>()

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const isLoadingDetail = ref(false)
const detail = ref<MaterialDeliveryDetail | null>(null)
const imageUrls = ref<string[]>([])
const imageIndex = ref(0)

const catLines = ref<CatLineResponse[]>([])
const isLoadingCatLines = ref(false)
const catPhotoBlobUrls = ref<Record<number, string>>({})

const ccstLines = ref<CcstLineResponse[]>([])
const isLoadingCcstLines = ref(false)
const ccstPhotoBlobUrls = ref<Record<number, string>>({})

const isDeleting = ref(false)
const showDeleteDialog = ref(false)

const photoTypeLabels: Record<PhotoType, string> = {
  DELIVERY_NOTE: '송장',
  MILL_SHEET: '밀시트',
  TAG: '태그',
  DELIVERY_PHOTO: '반입사진',
}
const photoTypeBorder: Record<PhotoType, string> = {
  DELIVERY_NOTE: 'border-blue-600',
  MILL_SHEET: 'border-amber-600',
  TAG: 'border-purple-600',
  DELIVERY_PHOTO: 'border-green-600',
}
const photoTypeText: Record<PhotoType, string> = {
  DELIVERY_NOTE: 'text-blue-600',
  MILL_SHEET: 'text-amber-600',
  TAG: 'text-purple-600',
  DELIVERY_PHOTO: 'text-green-600',
}

function revokeBlobUrl(url: string | undefined | null) {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

function clearImageBlobs() {
  imageUrls.value.forEach(revokeBlobUrl)
  imageUrls.value = []
}

function clearCatPhotoBlobs() {
  Object.values(catPhotoBlobUrls.value).forEach(revokeBlobUrl)
  catPhotoBlobUrls.value = {}
}

function clearCcstPhotoBlobs() {
  Object.values(ccstPhotoBlobUrls.value).forEach(revokeBlobUrl)
  ccstPhotoBlobUrls.value = {}
}

async function loadDetail() {
  isLoadingDetail.value = true
  try {
    const loaded = await materialOrderApi.getMaterialDeliveryDetail(props.materialDeliveryId)
    detail.value = loaded
    imageIndex.value = 0
    if (loaded.photoFiles.length > 0) {
      const settled = await Promise.allSettled(
        loaded.photoFiles.map((f) => fileApi.objectUrlByKey(f.url)),
      )
      imageUrls.value = settled
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map((r) => r.value)
    }
  } catch (error: unknown) {
    console.error('반입자재 상세 로드 실패:', error)
  } finally {
    isLoadingDetail.value = false
  }
}

async function loadCatLines() {
  isLoadingCatLines.value = true
  try {
    const list = await catDocumentApi.getCatLineList(props.materialDeliveryId)
    catLines.value = [...list].sort((a, b) => a.batch - b.batch)
    const allPhotos = catLines.value.flatMap((l) => l.photos)
    if (allPhotos.length > 0) {
      const settled = await Promise.allSettled(
        allPhotos.map((p) => fileApi.objectUrlByKey(p.url)),
      )
      settled.forEach((r, i) => {
        const photo = allPhotos[i]
        if (r.status === 'fulfilled' && photo) {
          catPhotoBlobUrls.value[photo.photoId] = r.value
        }
      })
    }
  } catch (error: unknown) {
    console.error('CAT 라인 로드 실패:', error)
    catLines.value = []
  } finally {
    isLoadingCatLines.value = false
  }
}

async function loadCcstLines() {
  isLoadingCcstLines.value = true
  try {
    const list = await ccstDocumentApi.getCcstLineList(props.materialDeliveryId)
    ccstLines.value = [...list].sort((a, b) => {
      if (a.lot !== b.lot) return a.lot - b.lot
      if (a.setNo !== b.setNo) return a.setNo - b.setNo
      return a.ageDays - b.ageDays
    })
    const allPhotos = ccstLines.value.flatMap((l) => l.photos)
    if (allPhotos.length > 0) {
      const settled = await Promise.allSettled(
        allPhotos.map((p) => fileApi.objectUrlByKey(p.url)),
      )
      settled.forEach((r, i) => {
        const photo = allPhotos[i]
        if (r.status === 'fulfilled' && photo) {
          ccstPhotoBlobUrls.value[photo.photoId] = r.value
        }
      })
    }
  } catch (error: unknown) {
    console.error('CCST 라인 로드 실패:', error)
    ccstLines.value = []
  } finally {
    isLoadingCcstLines.value = false
  }
}

watch(
  () => props.materialDeliveryId,
  () => {
    clearImageBlobs()
    clearCatPhotoBlobs()
    clearCcstPhotoBlobs()
    detail.value = null
    catLines.value = []
    ccstLines.value = []
    void loadDetail()
    void loadCatLines()
    void loadCcstLines()
  },
)

onMounted(() => {
  void loadDetail()
  void loadCatLines()
  void loadCcstLines()
})

onUnmounted(() => {
  clearImageBlobs()
  clearCatPhotoBlobs()
  clearCcstPhotoBlobs()
})

function prevImage() {
  if (imageUrls.value.length === 0) return
  imageIndex.value = imageIndex.value > 0 ? imageIndex.value - 1 : imageUrls.value.length - 1
}

function nextImage() {
  if (imageUrls.value.length === 0) return
  imageIndex.value = imageIndex.value < imageUrls.value.length - 1 ? imageIndex.value + 1 : 0
}

function currentPhotoType(): PhotoType | null {
  if (!detail.value) return null
  if (imageIndex.value >= detail.value.photoFiles.length) return null
  return detail.value.photoFiles[imageIndex.value]?.type ?? null
}

async function confirmDelete() {
  isDeleting.value = true
  try {
    await materialOrderApi.deleteMaterialDelivery(props.materialDeliveryId)
    showDeleteDialog.value = false
    analyticsClient.trackAction('material_delivery', 'delete_delivery', 'success')
    emit('deleted')
  } catch (error: unknown) {
    console.error('반입자재 삭제 실패:', error)
    analyticsClient.trackAction('material_delivery', 'delete_delivery', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <span v-if="initialMaterialTypeName" class="text-sm font-medium">
        {{ initialMaterialTypeName }}
      </span>
      <span v-if="initialDeliveryDate" class="text-xs text-muted-foreground">
        {{ initialDeliveryDate }}
      </span>
      <span v-if="initialMirDocumentNumber" class="text-xs text-muted-foreground">
        MIR: {{ initialMirDocumentNumber }}
      </span>
      <span v-if="initialCatDocumentNumber" class="text-xs text-muted-foreground">
        CAT: {{ initialCatDocumentNumber }}
      </span>
      <span v-if="initialCcstDocumentNumber" class="text-xs text-muted-foreground">
        CCST: {{ initialCcstDocumentNumber }}
      </span>
      <Button
        variant="ghost"
        size="sm"
        class="ml-auto h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
        @click="showDeleteDialog = true"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>

    <div v-if="isLoadingDetail || !detail" class="text-sm text-muted-foreground text-center py-8">
      반입자재 상세 로딩 중...
    </div>

    <template v-else>
      <div class="flex flex-col md:flex-row gap-4">
        <div class="md:w-1/2 space-y-2">
          <div
            v-if="imageUrls.length > 0"
            class="h-[480px] border-4 rounded-lg overflow-hidden bg-muted/20"
            :class="currentPhotoType() ? photoTypeBorder[currentPhotoType()!] : 'border-border'"
          >
            <img
              :src="imageUrls[imageIndex]"
              alt="반입자재 이미지"
              class="w-full h-full object-contain"
            />
          </div>
          <div v-else class="h-[480px] flex items-center justify-center border border-border rounded-lg bg-muted/20">
            <p class="text-sm text-muted-foreground">이미지가 없습니다</p>
          </div>
          <div v-if="imageUrls.length > 0" class="flex items-center justify-center gap-3">
            <Button v-if="imageUrls.length > 1" variant="outline" size="sm" @click="prevImage">
              ← 이전
            </Button>
            <span
              v-if="currentPhotoType()"
              class="text-sm font-medium"
              :class="photoTypeText[currentPhotoType()!]"
            >
              {{ photoTypeLabels[currentPhotoType()!] }}
            </span>
            <span class="text-sm text-muted-foreground">
              {{ imageIndex + 1 }} / {{ imageUrls.length }}
            </span>
            <Button v-if="imageUrls.length > 1" variant="outline" size="sm" @click="nextImage">
              다음 →
            </Button>
          </div>
          <div
            v-if="detail && imageIndex < detail.photoFiles.length"
            class="text-xs text-muted-foreground text-center"
          >
            {{ detail.photoFiles[imageIndex]?.description }}
          </div>
        </div>

        <div class="md:w-1/2 space-y-3">
          <div class="text-sm space-y-1">
            <div><span class="text-muted-foreground">공급업체:</span> {{ detail.supplier }}</div>
            <div v-if="detail.application">
              <span class="text-muted-foreground">사용부위:</span> {{ detail.application }}
            </div>
            <div v-if="detail.workTypeName">
              <span class="text-muted-foreground">공종:</span> {{ detail.workTypeName }}
            </div>
          </div>
          <div class="overflow-x-auto border border-border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>제조사</TableHead>
                  <TableHead>규격</TableHead>
                  <TableHead class="text-right">수량</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="line in detail.deliveryLines"
                  :key="line.deliveryLineId"
                >
                  <TableCell>{{ line.manufacturer ?? '-' }}</TableCell>
                  <TableCell>{{ line.materialSpecName ?? '-' }}</TableCell>
                  <TableCell class="text-right">
                    {{ line.quantity }}{{ initialUnit ?? '' }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-border space-y-2">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold">콘크리트받아들이기시험 회차</h3>
          <span v-if="catLines.length" class="text-xs text-muted-foreground">
            (총 {{ catLines.length }}회차)
          </span>
        </div>
        <div v-if="isLoadingCatLines" class="text-sm text-muted-foreground">로딩 중...</div>
        <div v-else-if="catLines.length === 0" class="text-sm text-muted-foreground">
          등록된 CAT 회차가 없습니다.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="line in catLines"
            :key="line.catLineId"
            class="border border-border rounded-md p-2 space-y-2"
          >
            <div class="text-sm font-semibold">{{ line.batch }}회차</div>
            <div class="grid grid-cols-5 gap-2 text-xs">
              <div><div class="text-muted-foreground">슬럼프</div><div>{{ line.slump ?? '-' }}</div></div>
              <div><div class="text-muted-foreground">공기량</div><div>{{ line.air ?? '-' }}</div></div>
              <div><div class="text-muted-foreground">온도</div><div>{{ line.temp ?? '-' }}</div></div>
              <div><div class="text-muted-foreground">염화물</div><div>{{ line.chloride ?? '-' }}</div></div>
              <div><div class="text-muted-foreground">단위수량</div><div>{{ line.water ?? '-' }}</div></div>
            </div>
            <div v-if="line.photos.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="p in line.photos"
                :key="p.photoId"
                class="w-[80px] h-[80px] rounded border border-border overflow-hidden"
              >
                <img
                  v-if="catPhotoBlobUrls[p.photoId]"
                  :src="catPhotoBlobUrls[p.photoId]"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground"
                >
                  로딩…
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-border space-y-2">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold">콘크리트압축강도시험 로트</h3>
          <span v-if="ccstLines.length" class="text-xs text-muted-foreground">
            (총 {{ ccstLines.length }}건)
          </span>
        </div>
        <div v-if="isLoadingCcstLines" class="text-sm text-muted-foreground">로딩 중...</div>
        <div v-else-if="ccstLines.length === 0" class="text-sm text-muted-foreground">
          등록된 CCST 로트가 없습니다.
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="line in ccstLines"
            :key="line.ccstLineId"
            class="border border-border rounded-md p-2 space-y-2"
          >
            <div class="text-sm font-semibold">
              {{ line.lot }}로트 · {{ line.setNo }}세트 · {{ line.ageDays }}일
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div><div class="text-muted-foreground">comp1</div><div>{{ line.comp1 ?? '-' }}</div></div>
              <div><div class="text-muted-foreground">comp2</div><div>{{ line.comp2 ?? '-' }}</div></div>
              <div><div class="text-muted-foreground">comp3</div><div>{{ line.comp3 ?? '-' }}</div></div>
            </div>
            <div v-if="line.photos.length > 0" class="flex flex-wrap gap-2">
              <div
                v-for="p in line.photos"
                :key="p.photoId"
                class="w-[80px] h-[80px] rounded border border-border overflow-hidden"
              >
                <img
                  v-if="ccstPhotoBlobUrls[p.photoId]"
                  :src="ccstPhotoBlobUrls[p.photoId]"
                  class="w-full h-full object-cover"
                />
                <div
                  v-else
                  class="w-full h-full bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground"
                >
                  로딩…
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>삭제 확인</AlertDialogTitle>
          <AlertDialogDescription>
            반입자재를 삭제하시겠습니까? 연결된 문서가 있으면 삭제되지 않습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">취소</AlertDialogCancel>
          <AlertDialogAction :disabled="isDeleting" @click="confirmDelete">
            {{ isDeleting ? '삭제 중...' : '삭제' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
