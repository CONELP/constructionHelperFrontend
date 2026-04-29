import apiClient from '@/shared/network-core/apiClient'
import type {
  DocumentJobResponse,
  MaterialInspectionRequestResponse,
  ProjectDocumentCodeResponse,
} from '@/features/document/model/document-types'

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
  async createMir(materialDeliveryId: number): Promise<MaterialInspectionRequestResponse> {
    const { data } = await apiClient.post<MaterialInspectionRequestResponse>(
      `/materialInspectionRequest/createMirDocument/${materialDeliveryId}`,
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
    await apiClient.put(`/materialInspectionRequest/updateMirDocumentNumber/${mirId}`, { documentNumber })
  },
}

export const catDocumentApi = {
  async createCatDocument(materialDeliveryId: number): Promise<DocumentJobResponse> {
    const { data } = await apiClient.post<DocumentJobResponse>(
      `/cat/createCatDocument/${materialDeliveryId}`,
      undefined,
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
}

export const ccstDocumentApi = {
  async createCcstDocument(materialDeliveryId: number): Promise<DocumentJobResponse> {
    const { data } = await apiClient.post<DocumentJobResponse>(
      `/ccst/createCcstDocument/${materialDeliveryId}`,
      undefined,
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
}
