module.exports = function(req, query) {
  return {
    success: true,
    text: query.text || '请提供text参数',
    timestamp: new Date().toISOString()
  };
};
