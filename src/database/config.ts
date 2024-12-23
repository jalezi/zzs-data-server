import { z } from 'zod';

type DataFile = {
  id: string;
  path: `./database/${string}.tsv.gz` | `./database/${string}.csv.gz`;
  format: 'tsv' | 'csv';
  schema?: z.ZodSchema;
};

const usersSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  email: z.string().email(),
});

const productsSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  price: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.coerce.number(),
  ),
});

export const dataFiles = [
  {
    id: 'users',
    path: './database/users.tsv.gz',
    format: 'tsv',
    schema: usersSchema,
  },
  {
    id: 'products',
    path: './database/products.csv.gz',
    format: 'csv',
    schema: productsSchema,
  },
] satisfies DataFile[];
