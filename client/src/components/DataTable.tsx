import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import './DataTable.css';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  id?: string;
}

export type { Column };

export default function DataTable<T>({
  columns,
  data,
  total = 0,
  page = 1,
  pageSize = 50,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = 'No data found.',
  id = 'data-table',
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize) || 1;

  const getValue = (row: T, key: string) => {
    return (row as Record<string, any>)[key];
  };

  return (
    <div className="data-table-wrapper" id={id}>
      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`data-table__th ${col.sortable ? 'data-table__th--sortable' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <span className="data-table__th-content">
                    {col.label}
                    {col.sortable && sortBy === col.key && (
                      sortOrder === 'asc'
                        ? <ChevronUp size={12} />
                        : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="data-table__row--skeleton">
                  {columns.map((col) => (
                    <td key={col.key}><div className="skeleton-block" /></td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="data-table__empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  className={`data-table__row ${onRowClick ? 'data-table__row--clickable' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="data-table__td">
                      {col.render
                        ? col.render(row)
                        : String(getValue(row, col.key) ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="data-table__pagination">
          <span className="data-table__pagination-info">
            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
          </span>
          <div className="data-table__pagination-controls">
            <button
              className="data-table__page-btn"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="data-table__page-num">
              {page} / {totalPages}
            </span>
            <button
              className="data-table__page-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
