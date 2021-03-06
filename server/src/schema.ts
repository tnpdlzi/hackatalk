import * as path from 'path';
import * as types from './types';

import { makeSchema } from '@nexus/schema';
import { nexusSchemaPrisma } from 'nexus-plugin-prisma/schema';

export const schema = makeSchema({
  types,
  plugins: [nexusSchemaPrisma()],
  outputs: {
    schema: path.join(__dirname, './generated/schema.graphql'),
    typegen: path.join(__dirname, './generated/nexus.ts'),
  },
  typegenAutoConfig: {
    sources: [
      {
        source: '@prisma/client',
        alias: 'client',
      },
      {
        source: require.resolve('./context'),
        alias: 'Context',
      },
    ],
    contextType: 'Context.Context',
  },
});
