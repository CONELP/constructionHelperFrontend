<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageContainer from '@/shared/helper-ui/PageContainer.vue'
import AreaCard from '@/shared/helper-ui/AreaCard.vue'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
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
import {
  formatMaterialOrderLineLocation as formatLocation,
  getMaterialOrderStatusBadgeClass as getStatusColor,
  getMaterialOrderStatusLabel as getStatusLabel,
} from '@/features/material/model/material-order-rules'
import { useMaterialOrder } from '@/features/material/view-model/useMaterialOrder'
import { analyticsClient } from '@/shared/analytics/analyticsClient'

const router = useRouter()
const { orders, isLoading, loadOrders, deleteOrder } = useMaterialOrder()
const expandedOrders = reactive<Record<number, boolean>>({})

const showDeleteDialog = ref(false)
const deleteTargetId = ref<number | null>(null)
const deleteTargetName = ref('')
const isDeletingOrder = ref(false)

function openDeleteDialog(orderId: number, orderNo: string) {
  deleteTargetId.value = orderId
  deleteTargetName.value = orderNo
  showDeleteDialog.value = true
}

async function confirmDeleteOrder() {
  if (deleteTargetId.value == null) return
  isDeletingOrder.value = true
  try {
    await deleteOrder(deleteTargetId.value)
    showDeleteDialog.value = false
    analyticsClient.trackAction('material_order', 'delete_order', 'success')
    loadOrders()
  } catch (error: unknown) {
    console.error('발주서 삭제 실패:', error)
    analyticsClient.trackAction('material_order', 'delete_order', 'fail')
    const err = error as { response?: { data?: { message?: string } }; message?: string }
    alert(err.response?.data?.message || err.message)
  } finally {
    isDeletingOrder.value = false
  }
}

function toggleOrder(orderId: number) {
  if (expandedOrders[orderId]) {
    expandedOrders[orderId] = false
  } else {
    for (const key of Object.keys(expandedOrders)) {
      expandedOrders[Number(key)] = false
    }
    expandedOrders[orderId] = true
  }
}

onMounted(() => {
  loadOrders()
})
</script>

<template>
  <PageContainer title="자재발주서">
    <AreaCard height="flex-1" min-height="1100px">
      <!-- 로딩 -->
      <div v-if="isLoading" class="text-sm text-muted-foreground text-center py-8">
        발주서 목록 로딩 중...
      </div>

      <!-- 빈 상태 -->
      <div
        v-else-if="orders.length === 0"
        class="flex items-center justify-center py-16 border border-dashed border-border rounded-lg"
      >
        <p class="text-muted-foreground">
          발주서가 없습니다. 3D 공정표에서 부재를 선택하여 발주서를 생성하세요.
        </p>
      </div>

      <!-- 발주서 카드 목록 -->
      <div v-else class="space-y-4">
        <div
          v-for="order in orders"
          :key="order.id"
          class="border border-border rounded-lg overflow-hidden"
        >
          <!-- 카드 헤더 (클릭으로 펼치기/접기) -->
          <div
            class="bg-muted/30 cursor-pointer select-none"
            @click="toggleOrder(order.id)"
          >
            <div class="flex items-center gap-3 px-4 py-3">
              <span class="text-xs text-muted-foreground">{{ expandedOrders[order.id] ? '▲' : '▼' }}</span>
              <Badge :class="['text-sm px-3 py-1', getStatusColor(order.orderStatus)]">
                {{ getStatusLabel(order.orderStatus) }}
              </Badge>
              <span class="text-sm font-medium">{{ order.orderNo }}</span>
              <span class="text-xs text-muted-foreground">{{ order.workTypeName }}</span>
              <span class="text-sm font-medium bg-muted/30 border border-foreground px-2 py-0.5 rounded">
                {{ order.totalQuantity }} {{ order.unit }}
              </span>
              <div class="flex items-center gap-2 ml-auto" @click.stop>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="order.orderStatus === 'ORDER_COMPLETED' || order.orderStatus === 'RECEIPT_COMPLETED'"
                >
                  발주하기
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="order.orderStatus !== 'ORDER_COMPLETED'"
                  @click="router.push('/helper/document/material-inspection')"
                >
                  송장입력
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  @click="openDeleteDialog(order.id, order.orderNo)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div v-if="order.specSummary?.length > 0" class="flex items-center gap-2 flex-wrap px-4 pb-3">
              <Badge
                v-for="spec in order.specSummary"
                :key="spec.materialSpecId"
                variant="outline"
                class="text-sm px-2.5 py-1"
              >
                {{ spec.materialSpecName }}:
                <span class="font-semibold ml-1">{{ spec.quantity }}</span>
                <span class="text-muted-foreground ml-0.5">{{ order.unit }}</span>
              </Badge>
            </div>
          </div>

          <!-- 라인 테이블 (접기/펼치기) -->
          <div v-if="expandedOrders[order.id]" class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>오브젝트</TableHead>
                  <TableHead>자재규격</TableHead>
                  <TableHead>부재코드</TableHead>
                  <TableHead>세부작업</TableHead>
                  <TableHead>위치</TableHead>
                  <TableHead class="text-right">수량</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="line in order.orderLines" :key="line.id">
                  <TableCell class="text-sm">{{ line.object3dId ?? '-' }}</TableCell>
                  <TableCell class="text-sm">{{ line.materialSpecName }}</TableCell>
                  <TableCell class="text-sm">{{ line.componentCodeName ?? '-' }}</TableCell>
                  <TableCell class="text-sm">{{ line.workStepName ?? '-' }}</TableCell>
                  <TableCell class="text-sm">{{ formatLocation(line) }}</TableCell>
                  <TableCell class="text-sm text-right">{{ line.quantity }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AreaCard>

    <!-- 발주서 삭제 확인 다이얼로그 -->
    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>삭제 확인</AlertDialogTitle>
          <AlertDialogDescription>
            '{{ deleteTargetName }}' 발주서를 삭제하시겠습니까?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeletingOrder">취소</AlertDialogCancel>
          <AlertDialogAction :disabled="isDeletingOrder" @click="confirmDeleteOrder">
            {{ isDeletingOrder ? '삭제 중...' : '삭제' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </PageContainer>
</template>
