import React from 'react';
import { DataTable } from './data-table';
import { ColumnDef } from '@tanstack/react-table';

interface DataTableWithLoadingProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: string;
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    onPageChange: (page: number) => void;
  };
  sorting?: {
    state: any;
    onSortingChange: (sorting: any) => void;
  };
  skeletonRows?: number;
}

export function DataTableWithLoading<TData, TValue>({
  columns,
  data,
  isLoading,
  isError = false,
  error = 'Ocorreu um erro ao carregar os dados.',
  pagination,
  sorting,
  skeletonRows = 5,
}: DataTableWithLoadingProps<TData, TValue>) {
  if (isError) {
    return (
      <div className="flex justify-center items-center p-8 border rounded-md bg-red-50">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={data || []}
      isLoading={isLoading}
      pagination={pagination}
      sorting={sorting}
      skeletonRows={skeletonRows}
    />
  );
}
