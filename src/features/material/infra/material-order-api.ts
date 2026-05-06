import apiClient from '@/shared/network-core/apiClient'
import type {
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
}
