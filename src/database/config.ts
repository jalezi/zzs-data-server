type DataFile = {
  id: string;
  path: `./database/${string}.tsv.gz` | `./database/${string}.csv.gz`;
  format: 'tsv' | 'csv';
};

export const dataFiles = [
  { id: 'users', path: './database/users.tsv.gz', format: 'tsv' },
  { id: 'products', path: './database/products.csv.gz', format: 'csv' },
] satisfies DataFile[];
