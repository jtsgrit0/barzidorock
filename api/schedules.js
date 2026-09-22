const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  let client = null;
  try {
    client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('barzidorock');
    const schedulesCollection = db.collection('schedules');

    if (req.method === 'GET') {
      // 모든 공연일정 가져오기 (날짜순으로 정렬)
      const schedules = await schedulesCollection.find({})
        .sort({ event_date: -1 })
        .toArray();
      
      // _id를 string으로 변환해서 프론트엔드에 전달
      const formattedSchedules = schedules.map(s => ({
        ...s,
        id: s.id || s._id.toString()
      }));

      res.status(200).json(formattedSchedules);
    } else if (req.method === 'POST') {
      // 관리자가 직접 공연일정 등록하는 로직 (기존 로직 유지)
      const newSchedule = req.body;
      const result = await schedulesCollection.insertOne({
        ...newSchedule,
        created_at: new Date().toISOString()
      });
      res.status(201).json({ success: true, id: result.insertedId });
    }

    await client.close();
  } catch (error) {
    console.error('Error handling schedules API:', error);
    if (client) await client.close();
    res.status(500).json({ error: 'Failed to process schedules request', details: error.message });
  }
};