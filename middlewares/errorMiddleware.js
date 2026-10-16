exports.notFound = (req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` });
};

exports.errorHandler = (err, req, res, next) => {
  if (err.code === 11000) {
    return res.status(409).json({ success: false, error: 'Duplicate value: record already exists' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, error: `Invalid ${err.path}` });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Malformed JSON body' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, error: err.message });
  }

  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
};
