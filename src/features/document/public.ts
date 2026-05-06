export { useMaterialInspectionPage } from '@/features/document/view-model/useMaterialInspectionPage'
export { useDailyReportPage } from '@/features/document/view-model/useDailyReportPage'
export {
  catDocumentApi,
  ccstDocumentApi,
  materialInspectionRequestApi,
  projectDocumentCodeApi,
} from '@/features/document/infra/project-document-code-api'
export { materialInspectionRequestRepository } from '@/features/document/infra/material-inspection-request-repository'
export { dailyReportRepository } from '@/features/document/infra/daily-report-repository'
export {
  deleteDocument,
  downloadDocument,
  getMaterialInspectionRequests,
  updateMirDocumentNumber,
} from '@/features/document/use-cases/material-inspection-request'
export {
  createDailyReport,
  deleteDailyReport,
  downloadDailyReport,
  getDailyReports,
  validateDailyReport,
} from '@/features/document/use-cases/daily-report'

export type { MaterialInspectionRequestRepository } from '@/features/document/use-cases/material-inspection-request'
export type { DailyReportRepository } from '@/features/document/use-cases/daily-report'
export type {
  CreateCatDocumentRequest,
  CreateCcstDocumentRequest,
  CreateMirDocumentRequest,
  DailyReportResponse,
  DocumentJobDocType,
  DocumentJobResponse,
  ImageCategory,
  MaterialInspectionRequestResponse,
  MirCellReference,
  ProjectDocumentCodeResponse,
  ValidateDailyReportPhotos,
  ValidateDailyReportResponse,
  ValidateDailyReportSection,
  ValidateDailyReportSectionItem,
  ValidateDailyReportPhotoItem,
} from '@/features/document/model/document-types'

export { default as ManagerPageView } from '@/features/document/ui/ManagerPage.vue'
export { default as DailyReportPageView } from '@/features/document/ui/DailyReportPage.vue'
export { default as MaterialInspectionPageView } from '@/features/document/ui/MaterialInspectionPage.vue'
export { default as CatDocumentPageView } from '@/features/document/ui/CatDocumentPage.vue'
export { default as CcstDocumentPageView } from '@/features/document/ui/CcstDocumentPage.vue'

export const documentRouteComponents = {
  ManagerPage: () => import('@/features/document/ui/ManagerPage.vue'),
  DailyReportPage: () => import('@/features/document/ui/DailyReportPage.vue'),
  MaterialInspectionPage: () => import('@/features/document/ui/MaterialInspectionPage.vue'),
  CatDocumentPage: () => import('@/features/document/ui/CatDocumentPage.vue'),
  CcstDocumentPage: () => import('@/features/document/ui/CcstDocumentPage.vue'),
}
