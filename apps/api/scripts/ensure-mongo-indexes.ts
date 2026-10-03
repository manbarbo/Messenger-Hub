import { MongoClient } from 'mongodb';
import { MONGO_INDEX_SPECS } from '../src/infrastructure/database/mongo-indexes';

async function main(): Promise<void> {
  const uri =
    process.env.MONGODB_URI ??
    'mongodb://messenger:messenger@localhost:27017/messenger_hub?authSource=admin';

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('messenger_hub');

  for (const spec of MONGO_INDEX_SPECS) {
    const options = spec.options ?? {};
    await db.collection(spec.collection).createIndex(spec.key as Record<string, 1>, options);
    console.info(`Ensured index on ${spec.collection}`, spec.key, options);
  }

  for (const name of ['messages', 'conversations', 'ai_traces']) {
    const indexes = await db.collection(name).indexes();
    console.info(
      name,
      indexes.map((i) => ({ name: i.name, key: i.key, unique: i.unique, sparse: i.sparse })),
    );
  }

  console.info('ping', await db.command({ ping: 1 }));
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
