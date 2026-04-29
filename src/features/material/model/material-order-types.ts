export interface MaterialOrderLineResponse {
  id: number
  taskId: number
  object3dId: number | null
  materialSpecId: number
  materialSpecName: string
  componentCodeId: number
  componentCodeName: string | null
  workStepId: number | null
  workStepName: string | null
  zoneId: number | null
  zoneName: string | null
  floorId: number | null
  floorName: string | null
  quantity: number
}

export interface SpecSummary {
  materialSpecId: number
  materialSpecName: string
  quantity: number
}

export interface MaterialOrderResponse {
  id: number
  orderNo: string
  orderStatus: string
  materialTypeId: number
  materialTypeName: string
  unit: string
  workTypeId: number
  workTypeName: string
  totalQuantity: number
  specSummary: SpecSummary[]
  orderedAt: string | null
  createdAt: string
  orderLines: MaterialOrderLineResponse[]
}

export type PhotoType = 'DELIVERY_NOTE' | 'MILL_SHEET' | 'TAG' | 'DELIVERY_PHOTO'

export interface DeliveryPhotoFile {
  photoId: number
  url: string
  type: PhotoType
  description: string
}

export interface MaterialDeliverySummary {
  materialDeliveryId: number
  materialTypeId: number
  materialTypeName: string
  deliveryDate: string
  unit: string
  mirDocumentNumber: string | null
  totalQuantity: number
  docId: number | null
}

export interface MaterialDeliveryDetail {
  materialDeliveryId: number
  supplier: string
  application: string | null
  workTypeId: number | null
  workTypeName: string | null
  photoFiles: DeliveryPhotoFile[]
  deliveryLines: DeliveryLineResponse[]
  docId: number | null
}

export interface CreateDeliveryResponse {
  deliveryId: number
}

export interface DeliveryLineResponse {
  deliveryLineId: number
  manufacturer: string | null
  materialSpecId: number | null
  materialSpecName: string | null
  quantity: number
}

export interface DeliveryQuantityByDate {
  materialTypeName: string
  materialSpecName: string
  totalQuantity: number
  unit: string
  workTypeName: string
}

export type MaterialOrderStatus = 'BEFORE_ORDER' | 'ORDER_COMPLETED' | 'RECEIPT_COMPLETED'

export type CatPhotoType =
  | 'SLUMP'
  | 'AIR'
  | 'TEMPERATURE'
  | 'CHLORIDE'
  | 'WATER'
  | 'OVERVIEW'
  | 'TEST_BOARD'

export interface CatPhotoFile {
  photoId: number
  type: CatPhotoType
  url: string
  description: string | null
}

export interface CatLineData {
  slump: number | null
  air: number | null
  temp: number | null
  chloride: number | null
  water: number | null
}

export interface CatLineResponse {
  catLineId: number
  materialDeliveryId: number
  batch: number
  slump: number | null
  air: number | null
  temp: number | null
  chloride: number | null
  water: number | null
  photos: CatPhotoFile[]
}

export interface CatBatchResult {
  batch: number
  catLineId: number
  photos: CatPhotoFile[]
  lineData: CatLineData
}

export interface CreateCatResponse {
  batches: CatBatchResult[]
}

export interface CreateCatBatchInput {
  batch: number
  images: File[]
}

export type CcstPhotoType = 'D7' | 'D7_BOARD' | 'D28' | 'D28_BOARD'

export interface CcstPhotoFile {
  photoId: number
  type: CcstPhotoType
  url: string
  description: string | null
}

export interface CcstLineData {
  comp1: number | null
  comp2: number | null
  comp3: number | null
}

export interface CcstLineResponse {
  ccstLineId: number
  materialDeliveryId: number
  batch: number
  setNo: number
  ageDays: number
  comp1: number | null
  comp2: number | null
  comp3: number | null
  photos: CcstPhotoFile[]
}

export interface CcstBatchResultLine {
  batch: number
  setNo: number
  ageDays: number
  ccstLineId: number
  photos: CcstPhotoFile[]
  lineData: CcstLineData
}

export interface CreateCcstResponse {
  lines: CcstBatchResultLine[]
}

export interface CreateCcstBatchInput {
  batch: number
  ageDays: 7 | 28
  images: File[]
}
