
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function migrateMongoData() {
  const localMongoUri = 'mongodb://localhost:27017';
  const remoteMongoUri = process.env.MONGODB_URI;

  if (!remoteMongoUri) {
    console.error('Error: MONGODB_URI is not defined in .env file.');
    process.exit(1);
  }

  let localClient;
  let remoteClient;

  try {
    // Connect to local and remote MongoDB
    localClient = new MongoClient(localMongoUri);
    remoteClient = new MongoClient(remoteMongoUri);
    await localClient.connect();
    await remoteClient.connect();

    console.log('Connected to local and remote MongoDB.');

    const localDb = localClient.db('barzidorock');
    const remoteDb = remoteClient.db('barzidorock');

    const localSchedules = localDb.collection('schedules');
    const remoteSchedules = remoteDb.collection('schedules');

    // Fetch all schedules from local DB
    const schedulesToMigrate = await localSchedules.find({}).toArray();
    console.log(`Found ${schedulesToMigrate.length} schedules in local database to migrate.`);

    if (schedulesToMigrate.length > 0) {
      // Clear remote collection before inserting
      // await remoteSchedules.deleteMany({});
      // console.log('Cleared existing schedules in remote database.');

      // Insert schedules into remote DB using upsert
      let upsertedCount = 0;
      for (const schedule of schedulesToMigrate) {
        const result = await remoteSchedules.updateOne(
          { venue_id: schedule.venue_id, event_date: schedule.event_date },
          { $set: schedule },
          { upsert: true }
        );
        if (result.upsertedCount > 0) {
          upsertedCount++;
        }
      }
      console.log(`Successfully upserted ${upsertedCount} new schedules into remote database.`);
    } else {
      console.log('No schedules to migrate.');
    }

  } catch (error) {
    console.error('Error during MongoDB data migration:', error);
  } finally {
    // Close connections
    if (localClient) await localClient.close();
    if (remoteClient) await remoteClient.close();
    console.log('MongoDB connections closed.');
  }
}

migrateMongoData();