module.exports = (req, res) => {
  const { POSTGRES_URL, POSTGRES_URL_NON_POOLING } = process.env;

  if (POSTGRES_URL && POSTGRES_URL_NON_POOLING) {
    res.status(200).json({ message: 'Database environment variables are present.' });
  } else {
    res.status(500).json({ 
      error: 'Database environment variables are missing.',
      POSTGRES_URL_exists: !!POSTGRES_URL,
      POSTGRES_URL_NON_POOLING_exists: !!POSTGRES_URL_NON_POOLING
    });
  }
};