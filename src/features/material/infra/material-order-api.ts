import apiClient from '@/shared/network-core/apiClient'
import type {
  CatLineResponse,
  CcstLineResponse,
  CreateCatBatchInput,
  CreateCatResponse,
  CreateCcstBatchInput,
  CreateCcstResponse,
  CreateDeliveryResponse,
  DeliveryQuantityByDate,
  MaterialDeliveryDetail,
  MaterialDeliverySummary,
  MaterialOrderResponse,
} from '@/features/material/model/material-order-types'

export const materialOrderApi = {
  async createMaterialOrder(
    object3dIds: number[],
    materialTypeId: number,
    workTypeId: number,
  ): Promise<MaterialOrderResponse> {
    const { data } = await apiClient.post<MaterialOrderResponse>(
      '/materialOrder/createMaterialOrder',
      { object3dIds, materialTypeId, workTypeId },
    )
    return data
  },

  async getTotalDeliveryQuantityByDate(date: string): Promise<DeliveryQuantityByDate[]> {
    const { data } = await apiClient.get<DeliveryQuantityByDate[]>(
      '/materialDelivery/getTotalDeliveryQuantityByDate',
      { params: { date } },
    )
    return data
  },

  async getMaterialOrderList(): Promise<MaterialOrderResponse[]> {
    const { data } = await apiClient.get<MaterialOrderResponse[]>(
      '/materialOrder/getMaterialOrderList',
    )
    return data
  },

  async getMaterialOrder(orderId: number): Promise<MaterialOrderResponse> {
    const { data } = await apiClient.get<MaterialOrderResponse>(
      `/materialOrder/getMaterialOrder/${orderId}`,
    )
    return data
  },

  async deleteMaterialOrder(orderId: number): Promise<void> {
    await apiClient.delete(`/materialOrder/deleteMaterialOrder/${orderId}`)
  },

  async createMaterialDelivery(params: {
    images: File[]
    application?: string
    workTypeName?: string
  }): Promise<CreateDeliveryResponse> {
    const formData = new FormData()
    if (params.application != null && params.application.length > 0) {
      formData.append('application', params.application)
    }
    if (params.workTypeName != null && params.workTypeName.length > 0) {
      formData.append('workTypeName', params.workTypeName)
    }
    params.images.forEach((file) => formData.append('images', file))

    const { data } = await apiClient.post<CreateDeliveryResponse>(
      '/materialDelivery/createMaterialDelivery',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      },
    )
    return data
  },

  async deleteMaterialDelivery(deliveryId: number): Promise<void> {
    await apiClient.delete(`/materialDelivery/deleteMaterialDelivery/${deliveryId}`)
  },

  async getMaterialDeliveryList(): Promise<MaterialDeliverySummary[]> {
    const { data } = await apiClient.get<MaterialDeliverySummary[]>(
      '/materialDelivery/getMaterialDeliveryList',
    )
    return data
  },

  async getMaterialDeliveryDetail(
    materialDeliveryId: number,
  ): Promise<MaterialDeliveryDetail> {
    const { data } = await apiClient.get<MaterialDeliveryDetail>(
      `/materialDelivery/getMaterialDeliveryDetail/${materialDeliveryId}`,
    )
    return data
  },

  async updateMaterialDelivery(
    deliveryId: number,
    body: {
      supplier?: string
      deliveryDate?: string
      application?: string
      workTypeId?: number
      addLines?: { manufacturer?: string; specId?: number; quantity?: string }[]
      updateLines?: { deliveryLineId: number; manufacturer?: string; specId?: number; quantity?: string }[]
      deleteLineIds?: number[]
      photoDescriptions?: { photoId: number; description: string }[]
      deletePhotoIds?: number[]
      replacePhotos?: { photoId: number; fileIndex: number }[]
    },
    files?: {
      deliveryPhotos?: File[]
      replacePhotoFiles?: File[]
    },
  ): Promise<void> {
    const formData = new FormData()
    formData.append(
      'data',
      new Blob([JSON.stringify(body)], { type: 'application/json' }),
    )
    files?.deliveryPhotos?.forEach((file) => formData.append('deliveryPhotos', file))
    files?.replacePhotoFiles?.forEach((file) => formData.append('replacePhotoFiles', file))
    await apiClient.put(
      `/materialDelivery/updateMaterialDelivery/${deliveryId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      },
    )
  },

  async createCat(
    materialDeliveryId: number,
    batches: CreateCatBatchInput[],
  ): Promise<CreateCatResponse> {
    const metadata = batches.map((b) => ({ batch: b.batch, count: b.images.length }))
    const formData = new FormData()
    formData.append('metadata', JSON.stringify(metadata))
    batches.forEach((b) => b.images.forEach((file) => formData.append('images', file)))
    const { data } = await apiClient.post<CreateCatResponse>(
      `/materialDelivery/createCatLine/${materialDeliveryId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      },
    )
    return data
  },

  async getCatLineList(materialDeliveryId: number): Promise<CatLineResponse[]> {
    const { data } = await apiClient.get<CatLineResponse[]>(
      '/materialDelivery/getCatLineList',
      { params: { materialDeliveryId } },
    )
    return data
  },

  async deleteCatLine(materialDeliveryId: number, catLineId: number): Promise<void> {
    await apiClient.delete(
      `/materialDelivery/deleteCatLine/${materialDeliveryId}/${catLineId}`,
    )
  },

  async createCcstLine(
    materialDeliveryId: number,
    batches: CreateCcstBatchInput[],
  ): Promise<CreateCcstResponse> {
    const metadata = batches.map((b) => ({
      batch: b.batch,
      ageDays: b.ageDays,
      count: b.images.length,
    }))
    const formData = new FormData()
    formData.append('metadata', JSON.stringify(metadata))
    batches.forEach((b) => b.images.forEach((file) => formData.append('images', file)))
    const { data } = await apiClient.post<CreateCcstResponse>(
      `/materialDelivery/createCcstLine/${materialDeliveryId}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      },
    )
    return data
  },

  async getCcstLineList(materialDeliveryId: number): Promise<CcstLineResponse[]> {
    const { data } = await apiClient.get<CcstLineResponse[]>(
      '/materialDelivery/getCcstLineList',
      { params: { materialDeliveryId } },
    )
    return data
  },

  async deleteCcstLine(materialDeliveryId: number, ccstLineId: number): Promise<void> {
    await apiClient.delete(
      `/materialDelivery/deleteCcstLine/${materialDeliveryId}/${ccstLineId}`,
    )
  },
}
