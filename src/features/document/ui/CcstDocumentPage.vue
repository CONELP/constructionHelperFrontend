<script setup lang="ts">
import PageContainer from '@/shared/helper-ui/PageContainer.vue'
import AreaCard from '@/shared/helper-ui/AreaCard.vue'
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
import { Download, Trash2 } from 'lucide-vue-next'
import { ccstDocumentApi } from '@/features/document/infra/project-document-code-api'
import { useDocumentJobListPage } from '@/features/document/view-model/useDocumentJobListPage'

const {
  isLoading,
  list,
  isDownloading,
  showDeleteDialog,
  deleteTargetName,
  isDeleting,
  openDeleteDialog,
  confirmDelete,
  downloadDocument,
  formatDate,
} = useDocumentJobListPage({
  loadList: ccstDocumentApi.getCcstDocumentList,
  analyticsScope: 'ccst_document',
})
</script>

<template>
  <PageContainer title="콘크리트압축강도시험">
    <AreaCard>
      <div v-if="isLoading" class="text-sm text-muted-foreground text-center py-8">
        목록 로딩 중...
      </div>

      <div v-else-if="list.length === 0" class="text-sm text-muted-foreground text-center py-8">
        생성된 콘크리트압축강도시험 문서가 없습니다.
      </div>

      <Table v-else>
        <TableHeader>
          <TableRow>
            <TableHead>문서번호</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>생성일</TableHead>
            <TableHead class="w-20 text-center">다운로드</TableHead>
            <TableHead class="w-20 text-center">삭제</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="job in list" :key="job.id">
            <TableCell class="font-medium">{{ job.docNo ?? '-' }}</TableCell>
            <TableCell>{{ job.status }}</TableCell>
            <TableCell>{{ formatDate(job.createdAt) }}</TableCell>
            <TableCell class="text-center">
              <Button
                v-if="job.status === 'SUCCEEDED'"
                variant="ghost"
                size="sm"
                class="h-8 w-8 p-0"
                :disabled="isDownloading[job.id]"
                @click="downloadDocument(job)"
              >
                <Download class="h-4 w-4 text-muted-foreground" />
              </Button>
              <span v-else class="text-xs text-muted-foreground">-</span>
            </TableCell>
            <TableCell class="text-center">
              <Button
                variant="ghost"
                size="sm"
                class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                @click="openDeleteDialog(job)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </AreaCard>

    <AlertDialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>삭제 확인</AlertDialogTitle>
          <AlertDialogDescription>
            '{{ deleteTargetName }}' 콘크리트압축강도시험 문서를 삭제하시겠습니까?
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
  </PageContainer>
</template>
