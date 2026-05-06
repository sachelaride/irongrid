import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@irongrid/server';

export const trpc = createTRPCReact<AppRouter>();
