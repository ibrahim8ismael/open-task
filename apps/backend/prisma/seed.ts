// B0 seed: default states + demo workspace/project (docs/05 B0).
// TODO: expand with demo user + membership once auth lands (B0.5).
import { DEFAULT_STATES } from "../src/common/utils/default-states";

export { DEFAULT_STATES };

async function main(): Promise<void> {
  // TODO B0.7: Prisma-backed seed (needs DATABASE_URL + generated client)
  // eslint-disable-next-line no-console
  console.log(`seed stub: ${DEFAULT_STATES.length} default states defined`);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
