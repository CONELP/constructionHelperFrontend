<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import PageContainer from '@/shared/helper-ui/PageContainer.vue'
import AreaCard from '@/shared/helper-ui/AreaCard.vue'
import { Button } from '@/shared/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { X } from 'lucide-vue-next'
import { DateRangeFilter } from '@/shared/ui/date-range-picker'
import { dateRangeToStrings, toCalendarDate } from '@/shared/utils/date-convert'
import { useCalendarStore } from '@/app/context/stores/calendarStore'
import ReferenceEditTrigger from '@/shared/helper-ui/ReferenceEditTrigger.vue'
import MaterialDeliveryEditPanel from '@/features/material/ui/components/MaterialDeliveryEditPanel.vue'
import { materialOrderApi } from '@/features/material/infra/material-order-api'
import type { MaterialDeliverySummary } from '@/features/material/model/material-order-types'
import { useMaterialOrder } from '@/features/material/view-model/useMaterialOrder'
import {
  catDocumentApi,
  ccstDocumentApi,
  materialInspectionRequestApi,
} from '@/features/document/public'
import type {
  CreateCatDocumentRequest,
  CreateCcstDocumentRequest,
  CreateMirDocumentRequest,
} from '@/features/document/public'
import { referenceApi } from '@/shared/network-core/apis/reference'
import type { MaterialTypeResponse } from '@/shared/network-core/apis/reference'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

const { loadOrders } = useMaterialOrder()
const calendarStore = useCalendarStore()
const calendarMinDate = computed(() =>
  calendarStore.calendarData?.projectStartDate
    ? toCalendarDate(calendarStore.calendarData.projectStartDate)
    : undefined,
)
const calendarMaxDate = computed(() =>
  calendarStore.calendarData?.projectEndDate
    ? toCalendarDate(calendarStore.calendarData.projectEndDate)
    : undefined,
)

const filterMaterialTypeId = ref<string>('__all__')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterDateRange = ref<any>({ start: undefined, end: undefined })
const filterMaterialTypes = ref<MaterialTypeResponse[]>([])

const deliveries = ref<MaterialDeliverySummary[]>([])
const isLoadingDeliveries = ref(false)

const expandedDeliveries = reactive<Record<number, boolean>>({})

const isGeneratingMir = reactive<Record<number, boolean>>({})
const isGeneratingCat = reactive<Record<number, boolean>>({})
const isGeneratingCcst = reactive<Record<number, boolean>>({})

const filteredDeliveries = computed(() => {
  let list = deliveries.value
  if (filterMaterialTypeId.value && filterMaterialTypeId.value !== '__all__') {
    const typeName = filterMaterialTypes.value.find(
      (t) => String(t.id) === filterMaterialTypeId.value,
    )?.name
    list = list.filter((d) => d.materialTypeName === typeName)
  }
  const range = dateRangeToStrings(filterDateRange.value)
  if (range.start && range.end) {
    list = list.filter(
      (d) => d.deliveryDate >= range.start! && d.deliveryDate <= range.end!,
    )
  } else if (range.start) {
    list = list.filter((d) => d.deliveryDate === range.start!)
  }
  return list
})

function toggleDelivery(delivery: MaterialDeliverySummary) {
  const id = delivery.materialDeliveryId
  if (expandedDeliveries[id]) {
    expandedDeliveries[id] = false
    return
  }
  for (const key of Object.keys(expandedDeliveries)) {
    expandedDeliveries[Number(key)] = false
  }
  expandedDeliveries[id] = true
}

function onPanelDeleted(deliveryId: number) {
  deliveries.value = deliveries.value.filter(
    (d) => d.materialDeliveryId !== deliveryId,
  )
  delete expandedDeliveries[deliveryId]
}

async function loadDeliveries() {
  isLoadingDeliveries.value = true
  try {
    deliveries.value = await materialOrderApi.getMaterialDeliveryList()
  } catch (error: unknown) {
    console.error('반입자재 목록 로딩 실패:', error)
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
  } finally {
    isLoadingDeliveries.value = false
  }
}

function reportError(scope: string, error: unknown) {
  console.error(`${scope} 실패:`, error)
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  alert(err.response?.data?.message || err.message)
}

async function generateMir(delivery: MaterialDeliverySummary) {
  const id = delivery.materialDeliveryId
  isGeneratingMir[id] = true
  try {
    const detail = await materialOrderApi.getMaterialDeliveryDetail(id)
    if (detail.workTypeId == null) {
      alert('공종이 매칭되지 않은 반입자재입니다. 공종을 먼저 지정해주세요.')
      return
    }
    const body: CreateMirDocumentRequest = {
      application: detail.application,
      supplier: detail.supplier,
      deliveryDate: delivery.deliveryDate,
      workTypeId: detail.workTypeId,
      lines: detail.deliveryLines.map((l) => ({
        manufacturer: l.manufacturer,
        materialSpecId: l.materialSpecId,
        quantity: String(l.quantity),
      })),
      photos: detail.photoFiles.map((p) => ({
        photoKey: p.url,
        type: p.type,
        description: p.description ?? null,
      })),
    }
    await materialInspectionRequestApi.createMirDocument(body)
    analyticsClient.trackAction('material_delivery', 'create_mir', 'success')
    await loadDeliveries()
  } catch (error: unknown) {
    analyticsClient.trackAction('material_delivery', 'create_mir', 'fail')
    reportError('MIR 문서 생성', error)
  } finally {
    isGeneratingMir[id] = false
  }
}

async function generateCat(delivery: MaterialDeliverySummary) {
  const id = delivery.materialDeliveryId
  isGeneratingCat[id] = true
  try {
    const [detail, catLines] = await Promise.all([
      materialOrderApi.getMaterialDeliveryDetail(id),
      catDocumentApi.getCatLineList(id),
    ])
    if (detail.workTypeId == null) {
      alert('공종이 매칭되지 않은 반입자재입니다. 공종을 먼저 지정해주세요.')
      return
    }
    if (catLines.length === 0) {
      alert('등록된 CAT 회차가 없습니다.')
      return
    }
    const body: CreateCatDocumentRequest = {
      application: detail.application,
      supplier: detail.supplier,
      deliveryDate: delivery.deliveryDate,
      workTypeId: detail.workTypeId,
      lines: detail.deliveryLines.map((l) => ({
        manufacturer: l.manufacturer,
        materialSpecId: l.materialSpecId,
        quantity: String(l.quantity),
      })),
      photos: detail.photoFiles.map((p) => ({
        photoKey: p.url,
        type: p.type,
        description: p.description ?? null,
      })),
      batches: catLines.map((cl) => ({
        batch: cl.batch,
        lineData: {
          slump: cl.slump,
          air: cl.air,
          temp: cl.temp,
          chloride: cl.chloride,
          water: cl.water,
        },
        photos: cl.photos.map((p) => ({
          photoKey: p.url,
          type: p.type,
          description: p.description,
        })),
      })),
    }
    await catDocumentApi.createCatDocument(body)
    analyticsClient.trackAction('material_delivery', 'create_cat', 'success')
    await loadDeliveries()
  } catch (error: unknown) {
    analyticsClient.trackAction('material_delivery', 'create_cat', 'fail')
    reportError('CAT 문서 생성', error)
  } finally {
    isGeneratingCat[id] = false
  }
}

async function generateCcst(delivery: MaterialDeliverySummary) {
  const id = delivery.materialDeliveryId
  if (!delivery.catDocumentNumber) {
    alert('CCST 는 CAT 문서가 먼저 생성되어야 합니다.')
    return
  }
  isGeneratingCcst[id] = true
  try {
    const [ccstLines, catDocs] = await Promise.all([
      ccstDocumentApi.getCcstLineList(id),
      catDocumentApi.getCatDocumentList(),
    ])
    if (ccstLines.length === 0) {
      alert('등록된 CCST 라인이 없습니다.')
      return
    }
    const catDoc = catDocs.find((d) => d.docNo === delivery.catDocumentNumber)
    if (!catDoc) {
      alert('이 반입자재에 연결된 CAT 문서를 찾지 못했습니다.')
      return
    }
    const body: CreateCcstDocumentRequest = {
      lines: ccstLines.map((l) => ({
        lot: l.lot,
        setNo: l.setNo,
        ageDays: l.ageDays as 7 | 28,
        comp1: l.comp1,
        comp2: l.comp2,
        comp3: l.comp3,
        testDate: null,
        photos: l.photos.map((p) => ({
          photoKey: p.url,
          type: p.type,
          description: p.description,
        })),
      })),
    }
    await ccstDocumentApi.createCcstDocument(catDoc.id, body)
    analyticsClient.trackAction('material_delivery', 'create_ccst', 'success')
    await loadDeliveries()
  } catch (error: unknown) {
    analyticsClient.trackAction('material_delivery', 'create_ccst', 'fail')
    reportError('CCST 문서 생성', error)
  } finally {
    isGeneratingCcst[id] = false
  }
}

onMounted(() => {
  loadOrders()
  loadDeliveries()
  referenceApi
    .getMaterialTypeList()
    .then((list) => (filterMaterialTypes.value = list))
    .catch(() => {})
})
</script>

<template>
  <PageContainer title="반입자재">
    <AreaCard height="flex-1" min-height="1100px">
      <div class="flex items-center justify-center gap-4 mb-4">
        <Select v-model="filterMaterialTypeId">
          <SelectTrigger class="w-[180px]">
            <SelectValue placeholder="자재유형 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">자재 전체</SelectItem>
            <SelectItem
              v-for="mt in filterMaterialTypes"
              :key="mt.id"
              :value="String(mt.id)"
            >
              {{ mt.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <DateRangeFilter
          v-model="filterDateRange"
          :min-value="calendarMinDate"
          :max-value="calendarMaxDate"
        />
        <Button
          v-if="filterDateRange.start"
          variant="ghost"
          size="sm"
          class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          @click="filterDateRange = { start: undefined, end: undefined }"
        >
          <X class="h-4 w-4" />
        </Button>
      </div>

      <div
        v-if="isLoadingDeliveries"
        class="text-sm text-muted-foreground text-center py-8"
      >
        반입자재 목록 로딩 중...
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="delivery in filteredDeliveries"
          :key="delivery.materialDeliveryId"
          class="border border-border rounded-lg overflow-hidden"
        >
          <div
            class="bg-muted/30 cursor-pointer select-none"
            @click="toggleDelivery(delivery)"
          >
            <div class="flex items-center gap-3 px-4 py-3">
              <span class="text-xs text-muted-foreground">
                {{ expandedDeliveries[delivery.materialDeliveryId] ? '▲' : '▼' }}
              </span>
              <span class="text-xs text-muted-foreground">
                #{{ delivery.materialDeliveryId }}
              </span>
              <span class="text-xs text-muted-foreground">
                {{ delivery.deliveryDate }}
              </span>
              <span class="text-sm font-medium inline-flex items-center gap-1">
                {{ delivery.materialTypeName }}
                <span @click.stop>
                  <ReferenceEditTrigger
                    type="material"
                    @refresh="loadDeliveries"
                  />
                </span>
              </span>
              <span
                v-if="delivery.totalQuantity"
                class="text-sm text-muted-foreground"
              >
                {{ delivery.totalQuantity }}{{ delivery.unit }}
              </span>
              <div
                class="ml-auto flex items-center gap-2"
                @click.stop
              >
                <span
                  v-if="delivery.mirDocumentNumber"
                  class="text-xs text-muted-foreground"
                >
                  MIR: {{ delivery.mirDocumentNumber }}
                </span>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="isGeneratingMir[delivery.materialDeliveryId]"
                  @click="generateMir(delivery)"
                >
                  {{ isGeneratingMir[delivery.materialDeliveryId] ? 'MIR 생성 중...' : 'MIR 생성' }}
                </Button>
                <span
                  v-if="delivery.catDocumentNumber"
                  class="text-xs text-muted-foreground"
                >
                  CAT: {{ delivery.catDocumentNumber }}
                </span>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="isGeneratingCat[delivery.materialDeliveryId]"
                  @click="generateCat(delivery)"
                >
                  {{ isGeneratingCat[delivery.materialDeliveryId] ? 'CAT 생성 중...' : 'CAT 생성' }}
                </Button>
                <span
                  v-if="delivery.ccstDocumentNumber"
                  class="text-xs text-muted-foreground"
                >
                  CCST: {{ delivery.ccstDocumentNumber }}
                </span>
                <Button
                  v-else
                  size="sm"
                  variant="outline"
                  :disabled="!delivery.catDocumentNumber || isGeneratingCcst[delivery.materialDeliveryId]"
                  @click="generateCcst(delivery)"
                >
                  {{ isGeneratingCcst[delivery.materialDeliveryId] ? 'CCST 생성 중...' : 'CCST 생성' }}
                </Button>
              </div>
            </div>
          </div>

          <div
            v-if="expandedDeliveries[delivery.materialDeliveryId]"
            class="p-4"
            @click.stop
          >
            <MaterialDeliveryEditPanel
              :material-delivery-id="delivery.materialDeliveryId"
              :initial-delivery-date="delivery.deliveryDate"
              :initial-material-type-name="delivery.materialTypeName"
              :initial-unit="delivery.unit"
              :initial-mir-document-number="delivery.mirDocumentNumber"
              :initial-cat-document-number="delivery.catDocumentNumber"
              :initial-ccst-document-number="delivery.ccstDocumentNumber"
              @deleted="onPanelDeleted(delivery.materialDeliveryId)"
            />
          </div>
        </div>
      </div>
    </AreaCard>
  </PageContainer>
</template>
