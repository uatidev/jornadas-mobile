import { useQuery } from "@tanstack/react-query";
import { jornadasService } from "@/src/services/jornadas";
import { JornadaResponse } from "@/src/utils/api";

/**
 * Hook para obtener las jornadas del día actual
 * @param filterByUserId - Si es true, filtra solo las jornadas del usuario actual. Si es false, obtiene todas las jornadas del día.
 */
export const useGetJornadasDelDia = (
  filterByUserId: boolean = true,
  enabled: boolean = true,
) => {
  return useQuery<JornadaResponse[]>({
    queryKey: ["jornadas", "del-dia", filterByUserId ? "mis-jornadas" : "todas"],
    queryFn: () => jornadasService.getJornadasDelDia(filterByUserId),
    enabled,
    staleTime: 30 * 1000, // 30 segundos - los datos se refrescan frecuentemente
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

