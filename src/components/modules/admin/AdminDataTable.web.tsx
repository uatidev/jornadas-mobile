import { Input } from "@/src/components/ui/input";
import { Text } from "@/src/components/ui/text";
import Monicon from "@monicon/native";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

export interface AdminTableColumn<T> {
  key: string;
  title: string;
  value: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  width?: number;
}

interface FilterOption {
  label: string;
  value: string;
}

export function AdminDataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Buscar...",
  emptyMessage = "No hay registros.",
  filterLabel,
  filterOptions,
  getFilterValue,
  renderActions,
}: {
  data: T[];
  columns: AdminTableColumn<T>[];
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  filterLabel?: string;
  filterOptions?: FilterOption[];
  getFilterValue?: (row: T) => string;
  renderActions?: (row: T) => ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-MX");
    const filtered = data.filter((row) => {
      if (filter && getFilterValue?.(row) !== filter) return false;
      return !term || columns.some((column) =>
        String(column.value(row)).toLocaleLowerCase("es-MX").includes(term),
      );
    });
    if (!sort) return filtered;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return filtered;
    return [...filtered].sort((a, b) => {
      const left = column.value(a);
      const right = column.value(b);
      const result = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), "es-MX", { numeric: true });
      return sort.direction === "asc" ? result : -result;
    });
  }, [columns, data, filter, getFilterValue, search, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const toggleSort = (column: AdminTableColumn<T>) => {
    if (column.sortable === false) return;
    setPage(0);
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key: column.key, direction: "asc" },
    );
  };

  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      <View className="flex-row flex-wrap items-center gap-3 border-b border-border p-4">
        <View className="min-w-64 flex-1 flex-row items-center gap-2">
          <Monicon name="ci:search-magnifying-glass" size={19} color="#71717a" />
          <Input
            className="flex-1"
            value={search}
            onChangeText={(value) => { setSearch(value); setPage(0); }}
            placeholder={searchPlaceholder}
          />
        </View>
        {filterOptions?.length && getFilterValue ? (
          <select
            aria-label={filterLabel || "Filtrar"}
            value={filter}
            onChange={(event) => { setFilter(event.currentTarget.value); setPage(0); }}
            className="min-h-10 rounded-lg border border-zinc-300 bg-transparent px-3 text-sm"
          >
            <option value="">{filterLabel || "Todos"}</option>
            {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        ) : null}
        <Text className="text-xs text-muted-foreground">{rows.length} registros</Text>
      </View>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead>
            <tr style={{ background: "hsl(var(--muted))" }}>
              {columns.map((column) => (
                <th key={column.key} style={{ width: column.width, padding: "12px 16px", textAlign: "left" }}>
                  <Pressable onPress={() => toggleSort(column)} className="flex-row items-center gap-1">
                    <Text className="text-xs font-bold">{column.title}</Text>
                    {column.sortable !== false ? (
                      <Monicon
                        name={sort?.key === column.key ? (sort.direction === "asc" ? "ci:chevron-up" : "ci:chevron-down") : "ci:arrow-down-up"}
                        size={14}
                        color="#71717a"
                      />
                    ) : null}
                  </Pressable>
                </th>
              ))}
              {renderActions ? <th style={{ width: 150, padding: "12px 16px", textAlign: "right" }}><Text className="text-xs font-bold">ACCIONES</Text></th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={getRowId(row)} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                {columns.map((column) => <td key={column.key} style={{ padding: "14px 16px", verticalAlign: "middle" }}>{column.render?.(row) ?? <Text className="text-sm">{column.value(row)}</Text>}</td>)}
                {renderActions ? <td style={{ padding: "14px 16px", textAlign: "right" }}>{renderActions(row)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visibleRows.length ? <Text className="p-10 text-center text-muted-foreground">{emptyMessage}</Text> : null}
      <View className="flex-row items-center justify-between border-t border-border px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">Filas</Text>
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.currentTarget.value)); setPage(0); }} className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm">
            {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </View>
        <View className="flex-row items-center gap-3">
          <Pressable disabled={currentPage === 0} onPress={() => setPage((value) => Math.max(0, value - 1))} className="rounded-lg border border-border p-2 disabled:opacity-40"><Monicon name="ci:chevron-left" size={18} color="#71717a" /></Pressable>
          <Text className="text-sm">Página {currentPage + 1} de {pageCount}</Text>
          <Pressable disabled={currentPage >= pageCount - 1} onPress={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="rounded-lg border border-border p-2 disabled:opacity-40"><Monicon name="ci:chevron-right" size={18} color="#71717a" /></Pressable>
        </View>
      </View>
    </View>
  );
}
