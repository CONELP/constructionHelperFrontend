import apiClient from '@/shared/network-core/apiClient'
import type {
  CatAnalysisResponse,
  CcstAnalysisResponse,
  CreateCatDocumentRequest,
  CreateCatDocumentResponse,
  CreateCcstDocumentRequest,
  CreateCcstDocumentResponse,
  CreateMirDocumentRequest,
  CreateMirDocumentResponse,
  DocumentJobResponse,
  MaterialInspectionRequestResponse,
  MirAnalysisResponse,
  ProjectDocumentCodeResponse,
  UpdateCatDataRequest,
  UpdateCcstDataRequest,
  UpdateMirDataRequest,
} from '@/features/document/model/document-types'
import type {
  CatLineResponse,
  CcstLineResponse,
} from '@/features/material/model/material-order-types'

const ANALYZE_TIMEOUT = 120000

export const projectDocumentCodeApi = {
  async createProjectDocumentCode(body: {
    mirCellReference?: string
    dailyReportCellReference?: string
  }): Promise<ProjectDocumentCodeResponse> {
    const { data } = await apiClient.post<ProjectDocumentCodeResponse>(
      '/projectDocumentCode/createProjectDocumentCode',
      body,
    )
    return data
  },

  async updateProjectDocumentCode(body: {
    mirCellReference?: string
    dailyReportCellReference?: string
  }): Promise<ProjectDocumentCodeResponse> {
    const { data } = await apiClient.put<ProjectDocumentCodeResponse>(
      '/projectDocumentCode/updateProjectDocumentCode',
      body,
    )
    return data
  },
}

export const materialInspectionRequestApi = {
  async analyzeMirPhoto(params: {
    images: File[]
    application?: string
    workTypeName?: string
  }): Promise<MirAnalysisResponse> {
    const formData = new FormData()
    if (params.application != null && params.application.length > 0) {
      formData.append('application', params.application)
    }
    if (params.workTypeName != null && params.workTypeName.length > 0) {
      formData.append('workTypeName', params.workTypeName)
    }
    params.images.forEach((file) => formData.append('images', file))

    const { data } = await apiClient.post<MirAnalysisResponse>(
      '/materialInspectionRequest/analyzeMirPhoto',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: ANALYZE_TIMEOUT,
      },
    )
    return data
  },

  async updateMirData(body: UpdateMirDataRequest): Promise<MirAnalysisResponse> {
    const { data } = await apiClient.post<MirAnalysisResponse>(
      '/materialInspectionRequest/updateMirData',
      body,
      { timeout: ANALYZE_TIMEOUT },
    )
    return data
  },

  async createMirDocument(
    body: CreateMirDocumentRequest,
  ): Promise<CreateMirDocumentResponse> {
    const { data } = await apiClient.post<CreateMirDocumentResponse>(
      '/materialInspectionRequest/createMirDocument',
      body,
      { timeout: ANALYZE_TIMEOUT },
    )
    return data
  },

  async getMirList(): Promise<MaterialInspectionRequestResponse[]> {
    const { data } = await apiClient.get<MaterialInspectionRequestResponse[]>(
      '/materialInspectionRequest/getMirDocumentList',
    )
    return data
  },

  async updateMirDocumentNumber(mirId: number, documentNumber: string): Promise<void> {
    await apiClient.put(
      `/materialInspectionRequest/updateMirDocumentNumber/${mirId}`,
      { documentNumber },
    )
  },
}

export const catDocumentApi = {
  async analyzeCatPhoto(params: {
    deliveryNoteImages: File[]
    batches: { batch: number; images: File[] }[]
    application?: string
    workTypeName?: string
  }): Promise<CatAnalysisResponse> {
    const formData = new FormData()
    if (params.application != null && params.application.length > 0) {
      formData.append('application', params.application)
    }
    if (params.workTypeName != null && params.workTypeName.length > 0) {
      formData.append('workTypeName', params.workTypeName)
    }
    params.deliveryNoteImages.forEach((file) => formData.append('deliveryNote', file))

    const metadata = params.batches.map((b) => ({
      batch: b.batch,
      count: b.images.length,
    }))
    formData.append('metadata', JSON.stringify(metadata))
    params.batches.forEach((b) =>
      b.images.forEach((file) => formData.append('batchPhotos', file)),
    )

    const { data } = await apiClient.post<CatAnalysisResponse>(
      '/cat/analyzeCatPhoto',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: ANALYZE_TIMEOUT,
      },
    )
    return data
  },

  async updateCatData(body: UpdateCatDataRequest): Promise<CatAnalysisResponse> {
    const { data } = await apiClient.post<CatAnalysisResponse>(
      '/cat/updateCatData',
      body,
      { timeout: ANALYZE_TIMEOUT },
    )
    return data
  },

  async createCatDocument(
    body: CreateCatDocumentRequest,
  ): Promise<CreateCatDocumentResponse> {
    const { data } = await apiClient.post<CreateCatDocumentResponse>(
      '/cat/createCatDocument',
      body,
      { timeout: 300000 },
    )
    return data
  },

  async getCatDocumentList(): Promise<DocumentJobResponse[]> {
    const { data } = await apiClient.get<DocumentJobResponse[]>(
      '/cat/getCatDocumentList',
    )
    return data
  },

  async getCatLineList(materialDeliveryId: number): Promise<CatLineResponse[]> {
    const { data } = await apiClient.get<CatLineResponse[]>(
      '/cat/getCatLineList',
      { params: { materialDeliveryId } },
    )
    return data
  },
}

export const ccstDocumentApi = {
  async analyzeCcstPhoto(params: {
    catDocId: number
    lots: { lot: number; ageDays: 7 | 28; images: File[] }[]
  }): Promise<CcstAnalysisResponse> {
    const formData = new FormData()
    formData.append('catDocId', String(params.catDocId))

    const metadata = params.lots.map((l) => ({
      lot: l.lot,
      ageDays: l.ageDays,
      count: l.images.length,
    }))
    formData.append('metadata', JSON.stringify(metadata))
    params.lots.forEach((l) =>
      l.images.forEach((file) => formData.append('lotPhotos', file)),
    )

    const { data } = await apiClient.post<CcstAnalysisResponse>(
      '/ccst/analyzeCcstPhoto',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: ANALYZE_TIMEOUT,
      },
    )
    return data
  },

  async updateCcstData(body: UpdateCcstDataRequest): Promise<CcstAnalysisResponse> {
    const { data } = await apiClient.post<CcstAnalysisResponse>(
      '/ccst/updateCcstData',
      body,
      { timeout: ANALYZE_TIMEOUT },
    )
    return data
  },

  async createCcstDocument(
    catDocId: number,
    body: CreateCcstDocumentRequest,
  ): Promise<CreateCcstDocumentResponse> {
    const { data } = await apiClient.post<CreateCcstDocumentResponse>(
      `/ccst/createCcstDocument/${catDocId}`,
      body,
      { timeout: 300000 },
    )
    return data
  },

  async getCcstDocumentList(): Promise<DocumentJobResponse[]> {
    const { data } = await apiClient.get<DocumentJobResponse[]>(
      '/ccst/getCcstDocumentList',
    )
    return data
  },

  async getCcstLineList(materialDeliveryId: number): Promise<CcstLineResponse[]> {
    const { data } = await apiClient.get<CcstLineResponse[]>(
      '/ccst/getCcstLineList',
      { params: { materialDeliveryId } },
    )
    return data
  },
}
