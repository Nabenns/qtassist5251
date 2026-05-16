import { DataTable as BaseDataTable, THead, TBody, TR, TH, TD, TableLoading, TableEmpty } from '../Table.jsx';

/**
 * MonoTable — alias for DataTable with the brutalist mono header look.
 *
 * After the Table component is re-skinned for the Brutalist redesign,
 * MonoTable behaves identically to DataTable. Existing pages can keep
 * importing DataTable; new pages or pages that want to be explicit
 * about the brutalist intent can import MonoTable.
 *
 * Props match DataTable.
 */
export function MonoTable(props) {
  return <BaseDataTable {...props} />;
}

export { THead, TBody, TR, TH, TD, TableLoading, TableEmpty };
