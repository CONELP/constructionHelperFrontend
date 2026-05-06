import type { DocumentJobResponse } from '@/shared/network-core/apis/document'

export type {
  DocumentJobDocType,
  DocumentJobStatus,
  DocumentJobResponse,
} from '@/shared/network-core/apis/document'

export type MaterialInspectionRequestResponse = DocumentJobResponse

// ===== analyze / update / create — MIR =====

export type MirPhotoType = 'DELIVERY_NOTE' | 'MILL_SHEET' | 'TAG' | 'DELIVERY_PHOTO'

export interface MirAnalyzedPhoto {
  photoKey: string
  mimeType: string
  data: string
  type: MirPhotoType
  description: string | null
}

export interface MirAnalyzedLine {
  lineKey: string
  manufacturer: string | null
  materialSpecId: number | null
  materialSpecName: string | null
  materialTypeId: number | null
  materialTypeName: string | null
  quantity: string
}

export interface MirAnalysisResponse {
  application: string | null
  workTypeId: number | null
  workTypeName: string | null
  supplier: string
  deliveryDate: string
  lines: MirAnalyzedLine[]
  photos: MirAnalyzedPhoto[]
}

export interface UpdateMirDataRequest extends MirAnalysisResponse {
  newWorkTypeName?: string
  newMaterialTypeName?: string
  newMaterialSpecName?: string
}

export interface CreateMirDocumentLine {
  manufacturer: string | null
  materialSpecId: number | null
  quantity: string
}

export interface CreateMirDocumentPhoto {
  photoKey: string
  type: MirPhotoType
  description: string | null
}

export interface CreateMirDocumentRequest {
  application: string | null
  supplier: string
  deliveryDate: string
  workTypeId: number | null
  lines: CreateMirDocumentLine[]
  photos: CreateMirDocumentPhoto[]
}

export interface CreateMirDocumentResponse extends DocumentJobResponse {
  materialDeliveryId: number
}

// ===== analyze / update / create — CAT =====

export type CatPhotoType =
  | 'SLUMP'
  | 'AIR'
  | 'TEMPERATURE'
  | 'CHLORIDE'
  | 'WATER'
  | 'OVERVIEW'
  | 'TEST_BOARD'

export interface CatAnalyzedBatchPhoto {
  photoKey: string
  mimeType: string
  data: string
  type: CatPhotoType
  description: string | null
}

export interface CatAnalyzedBatchLineData {
  slump: number | null
  air: number | null
  temp: number | null
  chloride: number | null
  water: number | null
}

export interface CatAnalyzedBatch {
  batch: number
  lineData: CatAnalyzedBatchLineData
  photos: CatAnalyzedBatchPhoto[]
}

export interface CatAnalysisResponse extends MirAnalysisResponse {
  batches: CatAnalyzedBatch[]
}

export interface UpdateCatDataRequest extends CatAnalysisResponse {
  newWorkTypeName?: string
  newMaterialTypeName?: string
  newMaterialSpecName?: string
}

export interface CreateCatDocumentBatchPhoto {
  photoKey: string
  type: CatPhotoType
  description: string | null
}

export interface CreateCatDocumentBatch {
  batch: number
  lineData: CatAnalyzedBatchLineData
  photos: CreateCatDocumentBatchPhoto[]
}

export interface CreateCatDocumentRequest extends CreateMirDocumentRequest {
  batches: CreateCatDocumentBatch[]
}

export type CreateCatDocumentResponse = CreateMirDocumentResponse

// ===== analyze / update / create — CCST =====

export type CcstPhotoType = 'D7' | 'D7_BOARD' | 'D28' | 'D28_BOARD'

export interface CcstAnalyzedLinePhoto {
  photoKey: string
  mimeType: string
  data: string
  type: CcstPhotoType
  description: string | null
}

export interface CcstAnalyzedLine {
  lineKey: string
  lot: number
  setNo: number
  ageDays: 7 | 28
  comp1: number | null
  comp2: number | null
  comp3: number | null
  testDate: string | null
  photos: CcstAnalyzedLinePhoto[]
}

export interface CcstAnalysisResponse {
  catDocId: number
  lines: CcstAnalyzedLine[]
}

export type UpdateCcstDataRequest = CcstAnalysisResponse

export interface CreateCcstDocumentLinePhoto {
  photoKey: string
  type: CcstPhotoType
  description: string | null
}

export interface CreateCcstDocumentLine {
  lot: number
  setNo: number
  ageDays: 7 | 28
  comp1: number | null
  comp2: number | null
  comp3: number | null
  testDate: string | null
  photos: CreateCcstDocumentLinePhoto[]
}

export interface CreateCcstDocumentRequest {
  lines: CreateCcstDocumentLine[]
}

export interface CreateCcstDocumentResponse extends DocumentJobResponse {
  materialDeliveryId: number
  ccstLineIds: number[]
}

export interface MirCellReference {
  delivery?: {
    supplier?: string
    deliveryDate?: string
    location?: string
    documentNumber?: string
    materialTypeName?: string
    divisionName?: string
  }
  lines?: {
    startCell: string
    maxRows?: number
    columns?: {
      no?: number
      specName?: number
      manufacturer?: number
      quantity?: number
      unit?: number
    }
    overflow?: { startCell: string; maxRows: number }[]
  }
  lineConcat?: {
    cell: string
    field: string
    separator: string
  }[]
  photos?: Record<
    string,
    {
      cells: string[]
      descriptionOffset?: { row: number; col: number }
    }
  >
}

export interface ProjectDocumentCodeResponse {
  id: number
  mirCellReference: string
  mirTemplateUrl: string | null
  dailyReportTemplateUrl: string | null
  dailyReportCellReference: string
  createdAt: string
  updatedAt: string
}

export interface ImageCategory {
  key: string
  label: string
}

// Daily Report types
export interface DailyReportResponse {
  id: number
  date: string
  dailyReportUrl: string | null
  createdAt: string
}

export interface ValidateDailyReportSectionItem {
  index: number
  rowKey: string
  values: (string | number | null)[]
}

export interface ValidateDailyReportSection {
  sectionName: string
  totalMaxRows: number
  dataRowCount: number
  exceeded: boolean
  columns: Record<string, number>
  items: ValidateDailyReportSectionItem[]
}

export interface ValidateDailyReportPhotoItem {
  index: number
  thumbnailUrl: string
  description: string
}

export interface ValidateDailyReportPhotos {
  totalCells: number
  photoCount: number
  exceeded: boolean
  items: ValidateDailyReportPhotoItem[]
}

export interface ValidateDailyReportResponse {
  sections: ValidateDailyReportSection[]
  photos: ValidateDailyReportPhotos | null
}
