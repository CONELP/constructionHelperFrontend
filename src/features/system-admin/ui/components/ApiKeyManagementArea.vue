<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Checkbox } from '@/shared/ui/checkbox'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
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
import { useCompanyManagement } from '@/features/system-admin/view-model/useCompanyManagement'
import { useApiKeyManagement } from '@/features/system-admin/view-model/useApiKeyManagement'
import { systemAdminApi } from '@/features/system-admin/infra/system-admin-api'
import type {
  ApiKeyMasked,
  ApiKeyScope,
  CompanyToProject,
  CreateApiKeyPayload,
} from '@/features/system-admin/model/system-admin-types'

const { companies, loadCompanies } = useCompanyManagement()
const {
  apiKeys,
  isLoading,
  isCreating,
  isDeleting,
  issuedKey,
  loadApiKeys,
  createApiKey,
  deleteApiKey,
  clearIssuedKey,
} = useApiKeyManagement()

const selectedCompanyId = ref<string>('')

const companyProjects = ref<CompanyToProject[]>([])
const isLoadingProjects = ref(false)

watch(selectedCompanyId, async (comId) => {
  if (!comId) {
    apiKeys.value = []
    companyProjects.value = []
    return
  }
  await Promise.all([loadApiKeys(comId), loadCompanyProjects(comId)])
})

async function loadCompanyProjects(comId: string) {
  isLoadingProjects.value = true
  try {
    companyProjects.value = await systemAdminApi.getCompanyToProjectList({
      companyId: comId,
    })
  } catch (error: unknown) {
    console.error('회사-프로젝트 매핑 조회 실패:', error)
    companyProjects.value = []
  } finally {
    isLoadingProjects.value = false
  }
}

const uniqueProjects = computed(() => {
  const seen = new Map<string, { projectId: string; projectName: string }>()
  for (const cp of companyProjects.value) {
    if (!seen.has(cp.projectId)) {
      seen.set(cp.projectId, { projectId: cp.projectId, projectName: cp.projectName })
    }
  }
  return Array.from(seen.values())
})

// 발급 Dialog
const isCreateDialogOpen = ref(false)
const form = ref<{
  name: string
  projectIds: string[]
  scope: ApiKeyScope
  expiresAt: string
  allowedIps: string
  rateLimit: string
}>({
  name: '',
  projectIds: [],
  scope: 'READ_ONLY',
  expiresAt: '',
  allowedIps: '',
  rateLimit: '60',
})

function resetForm() {
  form.value = {
    name: '',
    projectIds: [],
    scope: 'READ_ONLY',
    expiresAt: '',
    allowedIps: '',
    rateLimit: '60',
  }
}

function openCreateDialog() {
  if (!selectedCompanyId.value) {
    alert('회사를 먼저 선택해주세요.')
    return
  }
  resetForm()
  isCreateDialogOpen.value = true
}

function toggleProjectId(id: string) {
  form.value.projectIds = form.value.projectIds.includes(id)
    ? form.value.projectIds.filter((v) => v !== id)
    : [...form.value.projectIds, id]
}

async function handleCreate() {
  if (!form.value.name.trim()) {
    alert('키 이름을 입력해주세요.')
    return
  }
  if (form.value.name.length > 100) {
    alert('키 이름은 100자 이하여야 합니다.')
    return
  }
  if (form.value.projectIds.length === 0) {
    alert('프로젝트를 1개 이상 선택해주세요.')
    return
  }
  let expiresAt: string | null = null
  if (form.value.expiresAt) {
    const dt = new Date(form.value.expiresAt)
    if (Number.isNaN(dt.getTime())) {
      alert('유효한 만료 일시를 입력해주세요.')
      return
    }
    if (dt.getTime() <= Date.now()) {
      alert('만료 일시는 미래 시점이어야 합니다.')
      return
    }
    expiresAt = dt.toISOString()
  }
  const allowedIps = form.value.allowedIps.trim()
    ? form.value.allowedIps
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null
  const rateLimit = form.value.rateLimit.trim()
    ? Number(form.value.rateLimit)
    : null
  if (rateLimit != null && (Number.isNaN(rateLimit) || rateLimit <= 0)) {
    alert('Rate limit 값이 유효하지 않습니다.')
    return
  }

  const payload: CreateApiKeyPayload = {
    name: form.value.name.trim(),
    comId: selectedCompanyId.value,
    projectIds: form.value.projectIds,
    scope: form.value.scope,
    expiresAt,
    allowedIps,
    rateLimit,
  }
  const success = await createApiKey(payload)
  if (success) {
    isCreateDialogOpen.value = false
    resetForm()
  }
}

// 평문 키 노출 모달
async function copyPlaintextKey() {
  if (!issuedKey.value) return
  try {
    await navigator.clipboard.writeText(issuedKey.value.plaintextKey)
    alert('키가 복사되었습니다.')
  } catch {
    alert('복사에 실패했습니다. 직접 선택해 복사해주세요.')
  }
}

// 폐기 다이얼로그
const showRevokeDialog = ref(false)
const revokeTarget = ref<ApiKeyMasked | null>(null)

function openRevokeDialog(key: ApiKeyMasked) {
  revokeTarget.value = key
  showRevokeDialog.value = true
}

async function confirmRevoke() {
  if (revokeTarget.value && selectedCompanyId.value) {
    await deleteApiKey(revokeTarget.value.apiKeyId, selectedCompanyId.value)
  }
  showRevokeDialog.value = false
  revokeTarget.value = null
}

function projectNamesOf(key: ApiKeyMasked): string {
  if (key.projectIds.length === 0) return '-'
  const names = key.projectIds.map((pid) => {
    const match = companyProjects.value.find((cp) => cp.projectId === pid)
    return match?.projectName ?? pid.slice(0, 8)
  })
  return names.join(', ')
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(() => {
  loadCompanies()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">회사</Label>
        <Select v-model="selectedCompanyId">
          <SelectTrigger class="w-[280px]">
            <SelectValue placeholder="회사 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="company in companies"
              :key="company.id"
              :value="company.id"
            >
              {{ company.companyName }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button :disabled="!selectedCompanyId" @click="openCreateDialog">
        API 키 발급
      </Button>
    </div>

    <div class="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>키 (마스킹)</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>프로젝트</TableHead>
            <TableHead>만료</TableHead>
            <TableHead>마지막 사용</TableHead>
            <TableHead>상태</TableHead>
            <TableHead class="w-16 text-center">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!selectedCompanyId">
            <TableCell colspan="8" class="text-center text-muted-foreground">
              회사를 선택해주세요.
            </TableCell>
          </TableRow>
          <TableRow v-else-if="isLoading">
            <TableCell colspan="8" class="text-center text-muted-foreground">
              로딩 중...
            </TableCell>
          </TableRow>
          <TableRow v-else-if="apiKeys.length === 0">
            <TableCell colspan="8" class="text-center text-muted-foreground">
              발급된 API 키가 없습니다.
            </TableCell>
          </TableRow>
          <TableRow
            v-for="key in apiKeys"
            :key="key.apiKeyId"
            :class="key.revokedAt ? 'opacity-50' : ''"
          >
            <TableCell class="font-medium">{{ key.name }}</TableCell>
            <TableCell class="font-mono text-xs">
              {{ key.keyPrefix }}****{{ key.keyLast4 }}
            </TableCell>
            <TableCell>
              <span
                class="text-xs px-1.5 py-0.5 rounded"
                :class="key.scope === 'READ_WRITE' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'"
              >
                {{ key.scope }}
              </span>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground max-w-[280px] truncate">
              {{ projectNamesOf(key) }}
            </TableCell>
            <TableCell class="text-xs">
              {{ key.expiresAt ? formatDateTime(key.expiresAt) : '영구' }}
            </TableCell>
            <TableCell class="text-xs">
              {{ formatDateTime(key.lastUsedAt) }}
            </TableCell>
            <TableCell>
              <span
                v-if="key.revokedAt"
                class="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700"
              >
                폐기됨
              </span>
              <span
                v-else
                class="text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700"
              >
                활성
              </span>
            </TableCell>
            <TableCell class="text-center">
              <button
                v-if="!key.revokedAt"
                class="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                :disabled="isDeleting"
                @click.stop="openRevokeDialog(key)"
              >
                <X class="w-3 h-3" />
              </button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- 발급 Dialog -->
    <Dialog v-model:open="isCreateDialogOpen">
      <DialogContent class="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>API 키 발급</DialogTitle>
        </DialogHeader>
        <div class="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
          <div class="grid gap-1.5">
            <Label for="apikey-name">이름 *</Label>
            <Input
              id="apikey-name"
              v-model="form.name"
              placeholder="예: ai-agent-prod"
              maxlength="100"
            />
          </div>

          <div class="grid gap-1.5">
            <Label>프로젝트 *</Label>
            <p class="text-xs text-muted-foreground">
              이 회사가 매핑된 프로젝트만 노출됩니다.
            </p>
            <div
              class="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto"
            >
              <p
                v-if="isLoadingProjects"
                class="text-xs text-muted-foreground"
              >
                로딩 중...
              </p>
              <p
                v-else-if="uniqueProjects.length === 0"
                class="text-xs text-muted-foreground"
              >
                매핑된 프로젝트가 없습니다.
              </p>
              <label
                v-for="proj in uniqueProjects"
                :key="proj.projectId"
                class="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  :model-value="form.projectIds.includes(proj.projectId)"
                  @update:model-value="toggleProjectId(proj.projectId)"
                />
                <span>{{ proj.projectName }}</span>
              </label>
            </div>
          </div>

          <div class="grid gap-1.5">
            <Label for="apikey-scope">Scope *</Label>
            <Select
              :model-value="form.scope"
              @update:model-value="form.scope = $event as ApiKeyScope"
            >
              <SelectTrigger id="apikey-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="READ_ONLY">READ_ONLY (조회만)</SelectItem>
                <SelectItem value="READ_WRITE">READ_WRITE (조회+쓰기)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid gap-1.5">
            <Label for="apikey-expires">만료 일시</Label>
            <Input
              id="apikey-expires"
              v-model="form.expiresAt"
              type="datetime-local"
            />
            <p class="text-xs text-muted-foreground">비워두면 영구 유효.</p>
          </div>

          <div class="grid gap-1.5">
            <Label for="apikey-ips">허용 IP</Label>
            <Input
              id="apikey-ips"
              v-model="form.allowedIps"
              placeholder="예: 1.2.3.4, 5.6.7.8"
            />
            <p class="text-xs text-muted-foreground">
              쉼표로 구분. 비워두면 전체 허용.
            </p>
          </div>

          <div class="grid gap-1.5">
            <Label for="apikey-rate">Rate Limit (분당)</Label>
            <Input
              id="apikey-rate"
              v-model="form.rateLimit"
              type="number"
              min="1"
              placeholder="60"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="isCreateDialogOpen = false">
            취소
          </Button>
          <Button :disabled="isCreating" @click="handleCreate">
            {{ isCreating ? '발급 중...' : '발급' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 평문 키 노출 모달 (1회) -->
    <Dialog
      :open="issuedKey != null"
      @update:open="(open) => { if (!open) clearIssuedKey() }"
    >
      <DialogContent class="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>API 키 발급 완료</DialogTitle>
        </DialogHeader>
        <div v-if="issuedKey" class="space-y-3 py-2">
          <div class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p class="font-semibold mb-1">⚠ 이 키는 지금 한 번만 표시됩니다.</p>
            <p class="text-xs">
              지금 안전한 보관소에 복사해두세요. 분실 시 새 키를 발급해야 합니다.
            </p>
          </div>
          <div class="grid gap-1.5">
            <Label>이름</Label>
            <Input :model-value="issuedKey.name" readonly />
          </div>
          <div class="grid gap-1.5">
            <Label>Scope</Label>
            <Input :model-value="issuedKey.scope" readonly />
          </div>
          <div class="grid gap-1.5">
            <Label>평문 키</Label>
            <div class="flex gap-2">
              <Input
                :model-value="issuedKey.plaintextKey"
                readonly
                class="font-mono text-xs"
              />
              <Button variant="outline" @click="copyPlaintextKey">복사</Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button @click="clearIssuedKey">확인</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 폐기 확인 -->
    <AlertDialog :open="showRevokeDialog" @update:open="showRevokeDialog = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>API 키 폐기</AlertDialogTitle>
          <AlertDialogDescription>
            '{{ revokeTarget?.name }}' 키를 폐기하시겠습니까? 폐기 후 즉시 인증이 차단됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">취소</AlertDialogCancel>
          <AlertDialogAction :disabled="isDeleting" @click="confirmRevoke">
            {{ isDeleting ? '폐기 중...' : '폐기' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
